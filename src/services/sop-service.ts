import { canAccess } from "@/domain/authorization";
import { appError } from "@/domain/errors";
import type { ActorContext, KnowledgeScope, MemoryCandidate, SopDraft } from "@/domain/types";
import type { MemoryRepository } from "@/ports/memory-repository";
import type { ModelGateway } from "@/ports/model-gateway";
import type { MemoryRetrievalService } from "./memory-retrieval-service";

export class SopService {
  constructor(
    private readonly retrieval: MemoryRetrievalService,
    private readonly model: ModelGateway,
    private readonly memories: MemoryRepository,
  ) {}

  async generate(
    actor: ActorContext,
    saveAsSuggestion: boolean,
    request = "Create the Tuesday promotion SOP from our approved company rules.",
    scope: KnowledgeScope = { level: "COMPANY" },
  ): Promise<{ sop: SopDraft; candidate?: MemoryCandidate }> {
    if (!canAccess(actor, "READ", scope)) throw appError("FORBIDDEN");
    const approved = await this.retrieval.retrieve(request, actor, ["OPERATIONS"], scope);
    const sop = await this.model.generateSop({ request, approvedMemories: approved });
    if (!saveAsSuggestion) return { sop };
    if (!canAccess(actor, "SUGGEST", scope)) throw appError("FORBIDDEN");
    const now = new Date().toISOString();
    const candidate: MemoryCandidate = {
      id: `candidate-${crypto.randomUUID()}`,
      version: 1,
      companyId: actor.companyId,
      scope,
      type: "SOP",
      title: sop.title,
      statement: `${sop.purpose} ${sop.steps.map((step) => `${step.order}. ${step.action}`).join(" ")}`,
      rationale: "Make the owner's requested work repeatable for front desk staff.",
      rationaleMissing: false,
      appliesToRoles: ["OPERATIONS", "FRONT_DESK", "EMPLOYEE"],
      tags: ["sop", "tuesday-promotion"],
      sensitivity: "INTERNAL",
      sourceRefs: sop.sourceMemories.map((source) => ({
        sourceId: source.memoryId,
        label: "Approved pricing decision",
      })),
      confidence: 1,
      relation: "UNRELATED",
      relatedMemoryIds: sop.sourceMemories.map((source) => source.memoryId),
      status: "PROPOSED",
      extractionPromptVersion: "operations-assistant-1.0.0",
      modelId: "local-fixture-v1",
      createdBy: actor.userId,
      createdAt: now,
    };
    await this.memories.createCandidate(candidate);
    return { sop, candidate };
  }
}
