import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { canAccess, isOwner } from "@/domain/authorization";
import { appError } from "@/domain/errors";
import { candidateSchema, createManualCandidateSchema, knowledgeScopeSchema } from "@/domain/schemas";
import type {
  ActorContext,
  Company,
  KnowledgeScope,
  MemoryCandidate,
  Message,
  SourceReference,
} from "@/domain/types";
import type { CompanyRepository } from "@/ports/company-repository";
import type { MemoryRepository } from "@/ports/memory-repository";
import type { ModelGateway } from "@/ports/model-gateway";
import type { SourceRepository } from "@/ports/source-repository";
import type { MemoryRetrievalService } from "@/services/memory-retrieval-service";

const connectedSuggestionSchema = z.object({
  content: z.string().trim().min(3).max(4000),
  idempotencyKey: z.string().min(8).max(128),
  scope: knowledgeScopeSchema.optional().default({ level: "COMPANY" }),
});

const conversationSuggestionSchema = connectedSuggestionSchema.extend({
  conversationId: z.string().min(1).max(128),
  messageId: z.string().min(1).max(128),
  source: z.object({
    sourceId: z.string().min(1).max(128),
    label: z.string().min(1).max(200),
    messageId: z.string().min(1).max(128).optional(),
    excerpt: z.string().max(300).optional(),
  }),
});

const secretPatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\b(?:sk|rk|pk)_[a-zA-Z0-9_-]{20,}\b/,
  /\b(?:password|passwd|api[_ -]?key|client[_ -]?secret)\s*[:=]\s*\S{8,}/i,
  /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/,
];

export type ConnectedSuggestionResult =
  | { status: "NO_DURABLE_KNOWLEDGE"; message: string }
  | { status: "PROPOSED"; candidate: MemoryCandidate };

export class ConnectedSuggestionService {
  private readonly requestWindows = new Map<string, number[]>();

  constructor(
    private readonly memories: MemoryRepository,
    private readonly retrieval: MemoryRetrievalService,
    private readonly model: ModelGateway,
    private readonly sources: SourceRepository,
    private readonly companies: CompanyRepository,
  ) {}

  async suggest(input: unknown, actor: ActorContext): Promise<ConnectedSuggestionResult> {
    const values = connectedSuggestionSchema.parse(input);
    this.assertRateLimit(actor);
    const source = {
      sourceId: `source-connected-${randomUUID()}`,
      label: "Connected assistant conversation",
      excerpt: values.content.slice(0, 300),
    } satisfies SourceReference;
    return this.extractAndPersist({
      ...values,
      candidateId: this.candidateId(actor, `mcp:${values.idempotencyKey}`),
      conversationId: undefined,
      messageId: `connected-${randomUUID()}`,
      source,
      saveSource: true,
    }, actor);
  }

  async suggestFromConversation(input: unknown, actor: ActorContext): Promise<MemoryCandidate | null> {
    const values = conversationSuggestionSchema.parse(input);
    const result = await this.extractAndPersist({
      ...values,
      candidateId: this.candidateId(actor, `chat:${values.conversationId}:${values.idempotencyKey}`),
      saveSource: false,
    }, actor);
    return result.status === "PROPOSED" ? result.candidate : null;
  }

  async createManual(input: unknown, actor: ActorContext): Promise<MemoryCandidate> {
    const values = createManualCandidateSchema.parse(input);
    await this.assertSuggestionAccess(values.scope, actor);
    this.assertNoSecrets(values.statement);
    if (values.sensitivity === "CONFIDENTIAL" && !isOwner(actor)) throw appError("FORBIDDEN");
    const now = new Date().toISOString();
    const source = await this.sources.saveConversationSource(actor.companyId, {
      sourceId: `source-manual-suggestion-${randomUUID()}`,
      label: `Suggested directly by ${actor.displayName}`,
      excerpt: values.statement.slice(0, 300),
    });
    const draft: MemoryCandidate = {
      id: `candidate-${randomUUID()}`,
      version: 1,
      companyId: actor.companyId,
      scope: values.scope,
      type: values.type,
      title: values.title,
      statement: values.statement,
      rationale: values.rationale,
      rationaleMissing: values.rationale === null,
      appliesToRoles: values.appliesToRoles,
      tags: values.tags,
      sensitivity: values.sensitivity,
      sourceRefs: [source],
      confidence: 1,
      relation: "UNRELATED",
      relatedMemoryIds: [],
      status: "PROPOSED",
      extractionPromptVersion: "manual-suggestion-1.0.0",
      modelId: "human-authored",
      createdBy: actor.userId,
      createdAt: now,
    };
    return this.classifyValidatePersist(draft, actor);
  }

  private async extractAndPersist(input: {
    content: string;
    idempotencyKey: string;
    scope: KnowledgeScope;
    candidateId: string;
    conversationId?: string;
    messageId: string;
    source: SourceReference;
    saveSource: boolean;
  }, actor: ActorContext): Promise<ConnectedSuggestionResult> {
    await this.assertSuggestionAccess(input.scope, actor);
    this.assertNoSecrets(input.content);
    const existing = await this.memories.getCandidate(input.candidateId, actor.companyId);
    if (existing) return { status: "PROPOSED", candidate: existing };
    const now = new Date().toISOString();
    const message: Message = {
      id: input.messageId,
      companyId: actor.companyId,
      conversationId: input.conversationId ?? `connected-assistant-${actor.userId}`,
      actorType: "USER",
      actorId: actor.userId,
      content: input.content,
      sourceRefs: [],
      createdAt: now,
    };
    const extracted = await this.model.extractCandidate({ ownerMessage: message, createdBy: actor.userId });
    if (!extracted) {
      return {
        status: "NO_DURABLE_KNOWLEDGE",
        message: "Nothing in this excerpt appears to be durable company knowledge.",
      };
    }
    if (extracted.sensitivity === "CONFIDENTIAL" && !isOwner(actor)) throw appError("FORBIDDEN");
    const source = input.saveSource
      ? await this.sources.saveConversationSource(actor.companyId, input.source)
      : input.source;
    const candidate = await this.classifyValidatePersist({
      ...extracted,
      id: input.candidateId,
      companyId: actor.companyId,
      conversationId: input.conversationId,
      scope: input.scope,
      sourceRefs: [source],
      status: "PROPOSED",
      createdBy: actor.userId,
      createdAt: now,
    }, actor);
    return { status: "PROPOSED", candidate };
  }

  private async classifyValidatePersist(draft: MemoryCandidate, actor: ActorContext): Promise<MemoryCandidate> {
    const relatedApproved = await this.retrieval.retrieve(
      draft.statement,
      actor,
      draft.appliesToRoles,
      draft.scope,
    );
    const classification = await this.model.classifyRelationship({
      candidate: draft,
      approvedMemories: relatedApproved,
    });
    const candidate = candidateSchema.parse({
      ...draft,
      relation: classification.relation,
      relatedMemoryIds: classification.relatedMemoryIds,
    });
    const created = await this.memories.createCandidate(candidate);
    await this.memories.appendAudit({
      id: `audit-${randomUUID()}`,
      companyId: actor.companyId,
      actorId: actor.userId,
      action: "CANDIDATE_CREATED",
      targetType: "MEMORY_CANDIDATE",
      targetId: created.id,
      createdAt: candidate.createdAt,
    });
    return created;
  }

  private async assertSuggestionAccess(scope: KnowledgeScope, actor: ActorContext): Promise<void> {
    if (!canAccess(actor, "SUGGEST", scope)) throw appError("FORBIDDEN");
    await this.assertScope(scope, actor, await this.companies.get(actor.companyId));
  }

  private assertNoSecrets(content: string): void {
    if (secretPatterns.some((pattern) => pattern.test(content))) throw appError("VALIDATION_ERROR");
  }

  private candidateId(actor: ActorContext, idempotencyKey: string): string {
    const digest = createHash("sha256")
      .update(`${actor.companyId}:${actor.userId}:${idempotencyKey}`)
      .digest("hex")
      .slice(0, 32);
    return `candidate-${digest}`;
  }

  private assertRateLimit(actor: ActorContext): void {
    const key = `${actor.companyId}:${actor.userId}`;
    const cutoff = Date.now() - 60_000;
    const active = (this.requestWindows.get(key) ?? []).filter((timestamp) => timestamp > cutoff);
    if (active.length >= 10) throw appError("RATE_LIMITED");
    active.push(Date.now());
    this.requestWindows.set(key, active);
  }

  private async assertScope(scope: KnowledgeScope, actor: ActorContext, company: Company | null): Promise<void> {
    if (scope.level === "COMPANY") return;
    const valid = company?.organizationalUnits.some((unit) =>
      unit.id === scope.organizationalUnitId
      && unit.companyId === actor.companyId
      && unit.type === "DEPARTMENT",
    );
    if (!valid) throw appError("FORBIDDEN");
  }
}
