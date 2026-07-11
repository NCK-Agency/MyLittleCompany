import { createHash, randomUUID } from "node:crypto";
import { isOwner } from "@/domain/authorization";
import { appError, AppError } from "@/domain/errors";
import { containsLikelySecret } from "@/domain/secret-screening";
import {
  createImportSchema,
  createOnboardingSessionSchema,
  importBatchSchema,
  importedItemSchema,
  importedSourceSchema,
  onboardingSessionSchema,
  proveOnboardingSchema,
} from "@/domain/schemas";
import type {
  ActorContext,
  GroundedAnswer,
  HydratedMemory,
  ImportBatch,
  MemoryCandidate,
  OnboardingSession,
} from "@/domain/types";
import type { ImportRepository } from "@/ports/import-repository";
import type { MemoryRepository } from "@/ports/memory-repository";
import type { ModelGateway } from "@/ports/model-gateway";
import type { SourceRepository } from "@/ports/source-repository";
import type { SourceImporter } from "@/ports/source-importer";

export interface OnboardingSessionView {
  session: OnboardingSession;
  batch: ImportBatch | null;
  candidates: MemoryCandidate[];
}

export interface OnboardingProof {
  session: OnboardingSession;
  result: GroundedAnswer;
  searchStatus: "READY" | "UPDATING" | "NEEDS_ATTENTION";
}

function assertOwner(actor: ActorContext): void {
  if (!isOwner(actor)) throw appError("FORBIDDEN");
}

function sha256(value: string): string {
  return createHash("sha256").update(value.normalize("NFC")).digest("hex");
}

function addDays(date: Date, days: number): string {
  return new Date(date.getTime() + days * 86_400_000).toISOString();
}

function rankCandidates(candidates: MemoryCandidate[], proofQuestion: string): MemoryCandidate[] {
  const terms = new Set(proofQuestion.toLowerCase().split(/[^a-z0-9%]+/).filter((term) => term.length > 2));
  const relationWeight: Record<MemoryCandidate["relation"], number> = {
    CONTRADICTION: 5, UPDATE: 4, EXCEPTION: 4, DUPLICATE: 1, UNRELATED: 2,
  };
  return [...candidates].sort((left, right) => {
    const score = (candidate: MemoryCandidate): number => {
      const text = `${candidate.title} ${candidate.statement} ${candidate.tags.join(" ")}`.toLowerCase();
      const relevance = [...terms].filter((term) => text.includes(term)).length * 3;
      return relevance + relationWeight[candidate.relation] + candidate.confidence;
    };
    return score(right) - score(left) || right.createdAt.localeCompare(left.createdAt);
  });
}

export class OnboardingService {
  constructor(
    private readonly imports: ImportRepository,
    private readonly sources: SourceRepository,
    private readonly memories: MemoryRepository,
    private readonly model: ModelGateway,
    private readonly importer: SourceImporter,
  ) {}

  async createSession(input: unknown, actor: ActorContext): Promise<OnboardingSessionView> {
    assertOwner(actor);
    const values = createOnboardingSessionSchema.parse(input);
    const active = await this.imports.getActiveSession(actor.companyId, actor.userId);
    if (active) return this.view(active, actor);
    const now = new Date().toISOString();
    const session = onboardingSessionSchema.parse({
      id: `onboarding-${randomUUID()}`,
      version: 1,
      companyId: actor.companyId,
      createdBy: actor.userId,
      proofQuestion: values.proofQuestion,
      state: "SOURCE",
      prioritizedCandidateIds: [],
      approvedMemoryIds: [],
      createdAt: now,
      updatedAt: now,
    });
    return this.view(await this.imports.createSession(session), actor);
  }

  async active(actor: ActorContext): Promise<OnboardingSessionView | null> {
    assertOwner(actor);
    const session = await this.imports.getActiveSession(actor.companyId, actor.userId);
    return session ? this.view(session, actor) : null;
  }

  async get(sessionId: string, actor: ActorContext): Promise<OnboardingSessionView> {
    assertOwner(actor);
    const session = await this.imports.getSession(sessionId, actor.companyId);
    if (!session || session.createdBy !== actor.userId) throw appError("NOT_FOUND");
    return this.view(session, actor);
  }

  async createImport(input: unknown, actor: ActorContext): Promise<OnboardingSessionView> {
    assertOwner(actor);
    const values = createImportSchema.parse(input);
    const normalizedContent = values.content.normalize("NFC").replace(/\r\n?/g, "\n").trim();
    if (containsLikelySecret(normalizedContent)) throw appError("VALIDATION_ERROR");
    const session = await this.imports.getSession(values.sessionId, actor.companyId);
    if (!session || session.createdBy !== actor.userId) throw appError("NOT_FOUND");
    if (["COMPLETED", "SKIPPED"].includes(session.state)) throw appError("CONFLICT");
    const checksum = sha256(normalizedContent);
    const sourceIdentity = values.externalId ? `${values.externalId}:${checksum}` : checksum;
    const key = `${actor.companyId}:${actor.userId}:${session.id}:${values.provider}:${sourceIdentity}`;
    const existing = await this.imports.findBatchByIdempotencyKey(actor.companyId, key);
    if (existing) return this.view({ ...session, activeBatchId: existing.id }, actor);

    const now = new Date();
    const sourceId = `source-import-${randomUUID()}`;
    const storedSource = await this.importer.importSource(importedSourceSchema.parse({
      id: sourceId,
      companyId: actor.companyId,
      kind: values.provider === "CHATGPT" ? "CONVERSATION" : "MANUAL",
      provider: values.provider,
      title: values.title,
      externalId: values.externalId,
      checksum,
      contentStatus: "ACTIVE",
      retention: "UNAPPROVED_30_DAYS",
      deleteAfter: addDays(now, 30),
      createdBy: actor.userId,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    }), normalizedContent);
    const batchId = `import-${randomUUID()}`;
    const item = importedItemSchema.parse({
      id: `imported-item-${randomUUID()}`,
      companyId: actor.companyId,
      batchId,
      sourceId: storedSource.id,
      kind: storedSource.kind,
      provider: values.provider,
      title: values.title,
      externalId: values.externalId,
      checksum,
      contentLength: normalizedContent.length,
      state: "QUEUED",
      deleteAfter: storedSource.deleteAfter,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });
    const batch = importBatchSchema.parse({
      id: batchId,
      version: 1,
      companyId: actor.companyId,
      sessionId: session.id,
      createdBy: actor.userId,
      provider: values.provider,
      state: "DRAFT",
      stage: "NORMALIZE",
      idempotencyKey: key,
      checksum,
      itemIds: [item.id],
      candidateIds: [],
      readyItemCount: 0,
      failedItemCount: 0,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });
    await this.imports.createBatch(batch, item);
    const nextSession = await this.imports.updateSession(onboardingSessionSchema.parse({
      ...session,
      version: session.version + 1,
      state: "PROCESSING",
      activeBatchId: batch.id,
      updatedAt: now.toISOString(),
    }), session.version);
    return this.view(nextSession, actor);
  }

  async process(batchId: string, actor: ActorContext): Promise<OnboardingSessionView> {
    assertOwner(actor);
    const current = await this.imports.getBatch(batchId, actor.companyId);
    if (!current || current.createdBy !== actor.userId) throw appError("NOT_FOUND");
    if (current.state === "CANCELLED") throw appError("CONFLICT");
    const session = await this.imports.getSession(current.sessionId, actor.companyId);
    if (!session) throw appError("NOT_FOUND");
    if (current.state === "COMPLETED") return this.view(session, actor);

    const now = new Date();
    const leaseOwner = randomUUID();
    if (current.leaseExpiresAt && current.leaseExpiresAt > now.toISOString()) return this.view(session, actor);
    const leased = await this.imports.updateBatch(importBatchSchema.parse({
      ...current,
      version: current.version + 1,
      state: "PROCESSING",
      leaseOwner,
      leaseExpiresAt: new Date(now.getTime() + 30_000).toISOString(),
      updatedAt: now.toISOString(),
    }), current.version);

    try {
      if (leased.stage === "NORMALIZE") return await this.normalize(leased, session, actor);
      if (leased.stage === "EXTRACT") return await this.extract(leased, session, actor);
      if (leased.stage === "CLASSIFY") return await this.classify(leased, session, actor);
      return await this.finalize(leased, session, actor);
    } catch (error) {
      const latest = await this.imports.getBatch(batchId, actor.companyId);
      if (latest && latest.state !== "CANCELLED") {
        await this.imports.updateBatch(importBatchSchema.parse({
          ...latest,
          version: latest.version + 1,
          state: "FAILED",
          errorCode: error instanceof AppError ? error.code : "IMPORT_PROCESSING_FAILED",
          leaseOwner: undefined,
          leaseExpiresAt: undefined,
          updatedAt: new Date().toISOString(),
        }), latest.version).catch(() => undefined);
      }
      throw error;
    }
  }

  async cancel(batchId: string, actor: ActorContext): Promise<OnboardingSessionView> {
    assertOwner(actor);
    const batch = await this.imports.getBatch(batchId, actor.companyId);
    if (!batch || batch.createdBy !== actor.userId) throw appError("NOT_FOUND");
    if (batch.state === "COMPLETED") throw appError("CONFLICT");
    const now = new Date().toISOString();
    const cancelled = await this.imports.updateBatch(importBatchSchema.parse({
      ...batch, version: batch.version + 1, state: "CANCELLED", leaseOwner: undefined,
      leaseExpiresAt: undefined, updatedAt: now,
    }), batch.version);
    for (const itemId of cancelled.itemIds) {
      const item = await this.imports.getItem(itemId, actor.companyId);
      if (!item) continue;
      await this.imports.updateItem(importedItemSchema.parse({ ...item, state: "CANCELLED", updatedAt: now }));
      await this.sources.deleteImportedContent(item.sourceId, actor.companyId, actor.userId);
    }
    const session = await this.imports.getSession(cancelled.sessionId, actor.companyId);
    if (!session) throw appError("NOT_FOUND");
    const next = await this.imports.updateSession(onboardingSessionSchema.parse({
      ...session, version: session.version + 1, state: "SOURCE", activeBatchId: undefined, updatedAt: now,
    }), session.version);
    return this.view(next, actor);
  }

  async prove(sessionId: string, input: unknown, actor: ActorContext): Promise<OnboardingProof> {
    assertOwner(actor);
    const values = proveOnboardingSchema.parse(input);
    const session = await this.imports.getSession(sessionId, actor.companyId);
    if (!session || session.createdBy !== actor.userId || !session.activeBatchId) throw appError("NOT_FOUND");
    const batch = await this.imports.getBatch(session.activeBatchId, actor.companyId);
    if (!batch || batch.state !== "COMPLETED") throw appError("CONFLICT");
    const candidates = (await Promise.all(batch.candidateIds.map((id) => this.memories.getCandidate(id, actor.companyId))))
      .filter((candidate): candidate is MemoryCandidate => candidate !== null);
    const approvedIds = candidates.flatMap((candidate) => candidate.status === "APPROVED" && candidate.approvedMemoryId
      ? [candidate.approvedMemoryId] : []);
    const memories = (await Promise.all(approvedIds.map((id) => this.memories.getCurrent(id, actor.companyId))))
      .filter((memory): memory is HydratedMemory => memory !== null);
    if (memories.length === 0) throw appError("NO_APPROVED_CONTEXT");
    const provingSession = session.state === "REVIEWING"
      ? await this.imports.updateSession(onboardingSessionSchema.parse({
        ...session,
        version: session.version + 1,
        state: "PROVING",
        updatedAt: new Date().toISOString(),
      }), session.version)
      : session;
    const question = values.question ?? session.proofQuestion;
    const generated = await this.model.generateProofResponse({ question, approvedMemories: memories });
    const cited = new Set(generated.sourceMemoryIds);
    const citedMemories = memories.filter((memory) => cited.has(memory.record.id));
    if (citedMemories.length === 0) throw appError("NO_APPROVED_CONTEXT");
    const importedSourceIds = new Set(citedMemories.flatMap((memory) => memory.version.sourceRefs.map((source) => source.sourceId)));
    for (const sourceId of importedSourceIds) {
      await this.sources.retainImportedSource(sourceId, actor.companyId);
    }
    const now = new Date().toISOString();
    const completed = provingSession.state === "COMPLETED" ? provingSession : await this.imports.updateSession(onboardingSessionSchema.parse({
      ...provingSession,
      version: provingSession.version + 1,
      state: "COMPLETED",
      approvedMemoryIds: citedMemories.map((memory) => memory.record.id),
      completedAt: now,
      updatedAt: now,
    }), provingSession.version);
    const searchStatus = citedMemories.some((memory) => memory.record.indexStatus === "FAILED")
      ? "NEEDS_ATTENTION" as const
      : citedMemories.every((memory) => memory.record.indexStatus === "READY")
        ? "READY" as const : "UPDATING" as const;
    return {
      session: completed,
      result: {
        answer: generated.content,
        groundingStatus: "GROUNDED",
        sourceMemories: citedMemories.map((memory) => ({
          memoryId: memory.record.id,
          version: memory.version.version,
          title: memory.version.title,
          approvedAt: memory.version.approvedAt,
        })),
      },
      searchStatus,
    };
  }

  async deleteSource(sourceId: string, actor: ActorContext): Promise<void> {
    assertOwner(actor);
    await this.sources.deleteImportedContent(sourceId, actor.companyId, actor.userId);
  }

  async candidateRejected(candidate: MemoryCandidate, actor: ActorContext): Promise<void> {
    if (candidate.companyId !== actor.companyId || candidate.status !== "REJECTED") return;
    const candidates = await this.memories.listCandidates(actor.companyId);
    for (const sourceId of new Set(candidate.sourceRefs.map((source) => source.sourceId))) {
      const imported = await this.sources.getImportedSource(sourceId, actor.companyId);
      if (!imported || imported.source.retention === "APPROVED") continue;
      const fromSource = candidates.filter((item) => item.sourceRefs.some((source) => source.sourceId === sourceId));
      if (fromSource.length > 0 && fromSource.every((item) => item.status === "REJECTED")) {
        await this.sources.setImportedSourceExpiry(sourceId, actor.companyId, addDays(new Date(), 7), "ALL_IGNORED_7_DAYS");
      }
    }
  }

  private async normalize(batch: ImportBatch, session: OnboardingSession, actor: ActorContext): Promise<OnboardingSessionView> {
    const now = new Date().toISOString();
    const item = await this.imports.getItem(batch.itemIds[0]!, actor.companyId);
    if (!item) throw appError("NOT_FOUND");
    const parsing = await this.imports.updateItem(importedItemSchema.parse({ ...item, state: "PARSING", updatedAt: now }));
    await this.imports.updateItem(importedItemSchema.parse({ ...parsing, state: "READY", updatedAt: new Date().toISOString() }));
    await this.imports.updateBatch(importBatchSchema.parse({
      ...batch, version: batch.version + 1, stage: "EXTRACT", readyItemCount: 1,
      leaseOwner: undefined, leaseExpiresAt: undefined, updatedAt: now,
    }), batch.version);
    return this.view(session, actor);
  }

  private async extract(batch: ImportBatch, session: OnboardingSession, actor: ActorContext): Promise<OnboardingSessionView> {
    const item = await this.imports.getItem(batch.itemIds[0]!, actor.companyId);
    if (!item) throw appError("NOT_FOUND");
    const stored = await this.sources.getImportedSource(item.sourceId, actor.companyId);
    if (!stored?.content || stored.source.contentStatus !== "ACTIVE") throw appError("NOT_FOUND");
    const candidates = await this.model.extractOnboardingCandidates({
      companyId: actor.companyId,
      createdBy: actor.userId,
      proofQuestion: session.proofQuestion,
      source: { sourceId: stored.source.id, label: stored.source.title, content: stored.content },
    });
    for (const candidate of candidates.slice(0, 12)) await this.memories.createCandidate(candidate);
    const now = new Date().toISOString();
    if (candidates.length === 0) {
      const item = await this.imports.getItem(batch.itemIds[0]!, actor.companyId);
      if (item) await this.sources.setImportedSourceExpiry(item.sourceId, actor.companyId, addDays(new Date(), 1), "ZERO_CANDIDATE_24_HOURS");
    }
    await this.imports.updateBatch(importBatchSchema.parse({
      ...batch, version: batch.version + 1, stage: "CLASSIFY",
      candidateIds: candidates.slice(0, 12).map((candidate) => candidate.id),
      leaseOwner: undefined, leaseExpiresAt: undefined, updatedAt: now,
    }), batch.version);
    return this.view(session, actor);
  }

  private async classify(batch: ImportBatch, session: OnboardingSession, actor: ActorContext): Promise<OnboardingSessionView> {
    const approved = await this.memories.listCurrent(actor.companyId);
    const candidates: MemoryCandidate[] = [];
    for (const id of batch.candidateIds) {
      const candidate = await this.memories.getCandidate(id, actor.companyId);
      if (!candidate) continue;
      const relation = await this.model.classifyRelationship({ candidate, approvedMemories: approved });
      const updated = await this.memories.updateCandidate({
        ...candidate,
        version: candidate.version + 1,
        relation: relation.relation,
        relatedMemoryIds: relation.relatedMemoryIds,
      });
      candidates.push(updated);
    }
    const now = new Date().toISOString();
    await this.imports.updateBatch(importBatchSchema.parse({
      ...batch, version: batch.version + 1, stage: "FINALIZE",
      leaseOwner: undefined, leaseExpiresAt: undefined, updatedAt: now,
    }), batch.version);
    const currentSession = await this.imports.getSession(session.id, actor.companyId) ?? session;
    await this.imports.updateSession(onboardingSessionSchema.parse({
      ...currentSession,
      version: currentSession.version + 1,
      state: candidates.length === 0 ? "SOURCE" : "REVIEWING",
      prioritizedCandidateIds: rankCandidates(candidates, currentSession.proofQuestion).slice(0, 3).map((candidate) => candidate.id),
      updatedAt: now,
    }), currentSession.version);
    return this.get(session.id, actor);
  }

  private async finalize(batch: ImportBatch, session: OnboardingSession, actor: ActorContext): Promise<OnboardingSessionView> {
    const now = new Date().toISOString();
    await this.imports.updateBatch(importBatchSchema.parse({
      ...batch, version: batch.version + 1, state: "COMPLETED",
      leaseOwner: undefined, leaseExpiresAt: undefined, updatedAt: now,
    }), batch.version);
    return this.get(session.id, actor);
  }

  private async view(session: OnboardingSession, actor: ActorContext): Promise<OnboardingSessionView> {
    const batch = session.activeBatchId ? await this.imports.getBatch(session.activeBatchId, actor.companyId) : null;
    const ids = batch?.candidateIds ?? [];
    const candidates = (await Promise.all(ids.map((id) => this.memories.getCandidate(id, actor.companyId))))
      .filter((candidate): candidate is MemoryCandidate => candidate !== null);
    return { session, batch, candidates };
  }
}
