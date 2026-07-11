import { appError } from "@/domain/errors";
import { canAccess, isOwner } from "@/domain/authorization";
import { transitionCandidate, transitionIndex } from "@/domain/lifecycle";
import { isMemoryEligible } from "@/domain/retrieval";
import { amendMemorySchema, createMemoryPageSchema, resolveCandidateSchema, updateCandidateSchema } from "@/domain/schemas";
import type { ActorContext, HydratedMemory, MemoryCandidate, MemoryDetail, SourceReference } from "@/domain/types";
import type { CompanyRepository } from "@/ports/company-repository";
import type { ConversationRepository } from "@/ports/conversation-repository";
import type { KnowledgeIndex } from "@/ports/knowledge-index";
import type { MemoryRepository } from "@/ports/memory-repository";
import type { SourceRepository } from "@/ports/source-repository";
import type { ConnectedSuggestionService } from "@/services/connected-suggestion-service";

function assertOwner(actor: ActorContext): void {
  if (!isOwner(actor)) throw appError("FORBIDDEN");
}

export class MemoryService {
  constructor(
    private readonly memories: MemoryRepository,
    private readonly index: KnowledgeIndex,
    private readonly sources: SourceRepository,
    private readonly conversations: ConversationRepository,
    private readonly companies: CompanyRepository,
    private readonly suggestions: ConnectedSuggestionService,
  ) {}

  async listCandidates(actor: ActorContext): Promise<MemoryCandidate[]> {
    if (!isOwner(actor) && !actor.grants.some((grant) => grant.permission === "APPROVE")) {
      throw appError("FORBIDDEN");
    }
    return (await this.memories.listCandidates(actor.companyId)).filter((candidate) =>
      canAccess(actor, "APPROVE", candidate.scope)
      && (candidate.sensitivity !== "CONFIDENTIAL" || isOwner(actor)));
  }

  async listMemories(actor: ActorContext): Promise<HydratedMemory[]> {
    if (!isOwner(actor) && !actor.grants.some((grant) => grant.permission === "READ" || grant.permission === "APPROVE")) {
      throw appError("FORBIDDEN");
    }
    return (await this.memories.listCurrent(actor.companyId)).filter((memory) =>
      isOwner(actor)
        ? memory.record.status === "APPROVED"
        : isMemoryEligible(memory, actor),
    );
  }

  async getMemory(id: string, actor: ActorContext): Promise<MemoryDetail | null> {
    const memory = await this.memories.getCurrent(id, actor.companyId);
    if (!memory) return null;
    const visible = isOwner(actor)
      ? memory.record.status === "APPROVED"
      : isMemoryEligible(memory, actor);
    if (!visible) return null;
    const history = await this.memories.listVersions(id, actor.companyId);
    return {
      ...memory,
      history: isOwner(actor)
        ? history
        : history.filter((version) =>
            version.companyId === actor.companyId
            && canAccess(actor, "READ", version.scope)
            && version.sensitivity !== "CONFIDENTIAL"
            && version.appliesToRoles.some((role) => actor.roles.includes(role))),
    };
  }

  async amendMemory(id: string, input: unknown, actor: ActorContext): Promise<MemoryDetail> {
    assertOwner(actor);
    const values = amendMemorySchema.parse(input);
    await this.assertScope(values.scope, actor);
    const current = await this.memories.getCurrent(id, actor.companyId);
    if (!current) throw appError("NOT_FOUND");
    if (current.record.status !== "APPROVED") throw appError("CONFLICT");
    if (current.record.currentVersion !== values.expectedMemoryVersion) throw appError("STALE_WRITE");

    const now = new Date().toISOString();
    const directEditSource = await this.sources.saveConversationSource(actor.companyId, {
      sourceId: `source-playbook-edit-${crypto.randomUUID()}`,
      label: "Direct Playbook edit",
      excerpt: values.statement.slice(0, 300),
    });
    const updated = await this.memories.createVersion({
      companyId: actor.companyId,
      memoryId: id,
      expectedMemoryVersion: values.expectedMemoryVersion,
      title: values.title,
      scope: values.scope,
      statement: values.statement,
      rationale: values.rationale,
      appliesToRoles: values.appliesToRoles,
      tags: current.version.tags,
      sensitivity: current.version.sensitivity,
      sourceRefs: [...current.version.sourceRefs, directEditSource],
      actorId: actor.userId,
      approvedAt: now,
    });
    const indexed = await this.indexMemory(updated, actor);
    return {
      ...indexed,
      history: await this.memories.listVersions(id, actor.companyId),
    };
  }

  async createMemoryPage(input: unknown, actor: ActorContext): Promise<HydratedMemory> {
    assertOwner(actor);
    const values = createMemoryPageSchema.parse(input);
    await this.assertScope(values.scope, actor);
    const now = new Date().toISOString();
    const sourceRefs: SourceReference[] = [];

    if (values.conversationId) {
      const conversation = await this.conversations.get(values.conversationId, actor.companyId);
      if (!conversation) throw appError("NOT_FOUND");
      const messages = await this.conversations.listMessages(values.conversationId, actor.companyId);
      const selected = values.sourceMessageIds.length
        ? messages.filter((message) => values.sourceMessageIds.includes(message.id))
        : messages.slice(-2);
      if (!selected.length) throw appError("NOT_FOUND");
      sourceRefs.push(...selected.map((message) => ({
        sourceId: `source-${message.id}`,
        label: conversation.title,
        messageId: message.id,
        excerpt: message.content.slice(0, 300),
      })));
    } else {
      sourceRefs.push(await this.sources.saveConversationSource(actor.companyId, {
        sourceId: `source-playbook-create-${crypto.randomUUID()}`,
        label: "Created directly in the Company Playbook",
        excerpt: values.statement.slice(0, 300),
      }));
    }

    const memory = await this.memories.createApprovedMemory({
      companyId: actor.companyId,
      memoryId: `mem-${crypto.randomUUID()}`,
      type: values.type,
      title: values.title,
      statement: values.statement,
      rationale: values.rationale,
      scope: values.scope,
      appliesToRoles: values.appliesToRoles,
      tags: values.tags,
      sensitivity: values.sensitivity,
      sourceRefs,
      actorId: actor.userId,
      approvedAt: now,
    });
    return this.indexMemory(memory, actor);
  }

  async updateCandidate(
    id: string,
    input: unknown,
    actor: ActorContext,
  ): Promise<MemoryCandidate> {
    const values = updateCandidateSchema.parse(input);
    const candidate = await this.memories.getCandidate(id, actor.companyId);
    if (!candidate) throw appError("NOT_FOUND");
    this.assertCanApprove(candidate, actor);
    if (candidate.status !== "PROPOSED") throw appError("CONFLICT");
    if (candidate.version !== values.expectedCandidateVersion) throw appError("STALE_WRITE");
    return this.memories.updateCandidate({
      ...candidate,
      ...values,
      rationaleMissing: values.rationale === null,
      version: candidate.version + 1,
    });
  }

  async rejectCandidate(id: string, actor: ActorContext): Promise<MemoryCandidate> {
    const candidate = await this.memories.getCandidate(id, actor.companyId);
    if (!candidate) throw appError("NOT_FOUND");
    this.assertCanApprove(candidate, actor);
    const now = new Date().toISOString();
    return this.memories.updateCandidate({
      ...candidate,
      status: transitionCandidate(candidate.status, "REJECTED"),
      version: candidate.version + 1,
      reviewedBy: actor.userId,
      reviewedAt: now,
    });
  }

  async approveCandidate(
    id: string,
    expectedVersion: number,
    actor: ActorContext,
  ): Promise<HydratedMemory> {
    const candidate = await this.memories.getCandidate(id, actor.companyId);
    if (!candidate) throw appError("NOT_FOUND");
    this.assertCanApprove(candidate, actor);
    if (candidate.relation !== "UNRELATED") throw appError("CONFLICT");
    const now = new Date().toISOString();
    const approval = await this.memories.approveCandidate({
      companyId: actor.companyId,
      candidateId: id,
      expectedCandidateVersion: expectedVersion,
      actorId: actor.userId,
      approvedAt: now,
      memoryId: `mem-${crypto.randomUUID()}`,
      idempotencyKey: `${actor.companyId}:${id}:v${expectedVersion}`,
    });
    const memory = approval.memory;
    await this.retainImportedSources(memory, actor.companyId);
    if (!approval.created) return memory;
    return this.indexMemory(memory, actor);
  }

  async resolveCandidate(id: string, input: unknown, actor: ActorContext): Promise<HydratedMemory> {
    const values = resolveCandidateSchema.parse(input);
    let candidate = await this.memories.getCandidate(id, actor.companyId);
    if (!candidate) throw appError("NOT_FOUND");
    this.assertCanApprove(candidate, actor);
    if (candidate.status !== "PROPOSED") throw appError("CONFLICT");
    if (candidate.version !== values.expectedCandidateVersion) throw appError("STALE_WRITE");
    if (candidate.relation === "DUPLICATE" || candidate.relation === "UNRELATED") throw appError("CONFLICT");
    if (candidate.relation === "UPDATE" && values.resolution !== "UPDATE") throw appError("CONFLICT");
    if (candidate.relation === "EXCEPTION" && values.resolution !== "EXCEPTION") throw appError("CONFLICT");
    if (candidate.relation === "CONTRADICTION" && !["REPLACE", "EXCEPTION"].includes(values.resolution)) throw appError("CONFLICT");
    const relatedMemoryId = candidate.relatedMemoryIds[0];
    if (!relatedMemoryId) throw appError("CONFLICT");
    const current = await this.memories.getCurrent(relatedMemoryId, actor.companyId);
    if (!current) throw appError("NOT_FOUND");
    if (!canAccess(actor, "APPROVE", current.record.scope)) throw appError("FORBIDDEN");
    if (current.record.sensitivity === "CONFIDENTIAL" && !isOwner(actor)) throw appError("FORBIDDEN");

    if (values.resolution === "EXCEPTION") {
      const condition = values.condition!;
      candidate = await this.memories.updateCandidate({
        ...candidate,
        version: candidate.version + 1,
        statement: `${candidate.statement}\n\nException condition: ${condition}`,
        rationale: candidate.rationale
          ? `${candidate.rationale}\n\nThis is an exception to “${current.version.title}” when: ${condition}`
          : `Exception to “${current.version.title}” when: ${condition}`,
        rationaleMissing: false,
        relatedMemoryIds: [current.record.id],
      });
      const now = new Date().toISOString();
      const approval = await this.memories.approveCandidate({
        companyId: actor.companyId,
        candidateId: candidate.id,
        expectedCandidateVersion: candidate.version,
        actorId: actor.userId,
        approvedAt: now,
        memoryId: `mem-${crypto.randomUUID()}`,
        idempotencyKey: `${actor.companyId}:${candidate.id}:v${candidate.version}:exception`,
      });
      await this.retainImportedSources(approval.memory, actor.companyId);
      return approval.created ? this.indexMemory(approval.memory, actor) : approval.memory;
    }

    const now = new Date().toISOString();
    const approval = await this.memories.approveCandidateAsVersion({
      companyId: actor.companyId,
      candidateId: candidate.id,
      expectedCandidateVersion: candidate.version,
      memoryId: current.record.id,
      expectedMemoryVersion: current.record.currentVersion,
      actorId: actor.userId,
      approvedAt: now,
      idempotencyKey: `${actor.companyId}:${candidate.id}:v${candidate.version}:${values.resolution}:memory-v${current.record.currentVersion}`,
    });
    await this.retainImportedSources(approval.memory, actor.companyId);
    return approval.created ? this.indexMemory(approval.memory, actor) : approval.memory;
  }

  async retryIndex(memoryId: string, actor: ActorContext): Promise<HydratedMemory> {
    assertOwner(actor);
    const memory = await this.memories.getCurrent(memoryId, actor.companyId);
    if (!memory) throw appError("NOT_FOUND");
    if (memory.record.indexStatus !== "FAILED") throw appError("CONFLICT");
    memory.record.indexStatus = transitionIndex(memory.record.indexStatus, "PENDING");
    await this.memories.updateRecord(memory.record);
    return this.indexMemory(memory, actor);
  }

  async createSuggestion(input: unknown, actor: ActorContext): Promise<MemoryCandidate> {
    return this.suggestions.createManual(input, actor);
  }

  private async retainImportedSources(memory: HydratedMemory, companyId: string): Promise<void> {
    const sourceIds = new Set(memory.version.sourceRefs
      .map((source) => source.sourceId)
      .filter((sourceId) => sourceId.startsWith("source-import-")));
    for (const sourceId of sourceIds) {
      const imported = await this.sources.getImportedSource(sourceId, companyId);
      if (imported && imported.source.retention !== "APPROVED") {
        await this.sources.retainImportedSource(sourceId, companyId);
      }
    }
  }

  private async indexMemory(memory: HydratedMemory, actor: ActorContext): Promise<HydratedMemory> {
    let auditAction: "MEMORY_INDEX_READY" | "MEMORY_INDEX_FAILED";
    try {
      const document = await this.sources.saveMemoryDocument(memory);
      const indexed = await this.index.upsert(memory, document);
      memory.record.indexStatus = transitionIndex(memory.record.indexStatus, "READY");
      memory.record.indexDocumentId = indexed.documentId;
      delete memory.record.indexErrorCode;
      auditAction = "MEMORY_INDEX_READY";
    } catch {
      memory.record.indexStatus = transitionIndex(memory.record.indexStatus, "FAILED");
      memory.record.indexErrorCode = "INDEX_FAILED";
      auditAction = "MEMORY_INDEX_FAILED";
    }
    await this.memories.updateRecord(memory.record);
    await this.appendIndexAudit(memory, actor, auditAction);
    return memory;
  }

  private async appendIndexAudit(
    memory: HydratedMemory,
    actor: ActorContext,
    action: "MEMORY_INDEX_READY" | "MEMORY_INDEX_FAILED",
  ): Promise<void> {
    await this.memories.appendAudit({
      id: `audit-${crypto.randomUUID()}`,
      companyId: actor.companyId,
      actorId: actor.userId,
      action,
      targetType: "MEMORY",
      targetId: memory.record.id,
      createdAt: new Date().toISOString(),
    });
  }

  private async assertScope(scope: { level: "COMPANY" | "DEPARTMENT"; organizationalUnitId?: string }, actor: ActorContext): Promise<void> {
    if (scope.level === "COMPANY") return;
    const company = await this.companies.get(actor.companyId);
    const valid = company?.organizationalUnits.some((unit) =>
      unit.id === scope.organizationalUnitId
      && unit.companyId === actor.companyId
      && unit.type === "DEPARTMENT",
    );
    if (!valid) throw appError("FORBIDDEN");
  }

  private assertCanApprove(candidate: MemoryCandidate, actor: ActorContext): void {
    if (!canAccess(actor, "APPROVE", candidate.scope)) throw appError("FORBIDDEN");
    if (candidate.sensitivity === "CONFIDENTIAL" && !isOwner(actor)) throw appError("FORBIDDEN");
  }
}
