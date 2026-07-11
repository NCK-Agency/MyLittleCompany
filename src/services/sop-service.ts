import type { ActorContext, MemoryCandidate, SopDraft } from "@/domain/types";
import type { KnowledgeIndex } from "@/ports/knowledge-index";
import type { MemoryRepository } from "@/ports/memory-repository";
import type { ModelGateway } from "@/ports/model-gateway";

export class SopService {
  constructor(
    private readonly index: KnowledgeIndex,
    private readonly model: ModelGateway,
    private readonly memories: MemoryRepository,
  ) {}

  async generate(actor: ActorContext, saveAsSuggestion: boolean): Promise<{ sop: SopDraft; candidate?: MemoryCandidate }> {
    const approved = await this.index.retrieve("Tuesday promotion discount offer", {
      ...actor,
      roles: ["OPERATIONS"],
    });
    const sop = await this.model.generateSop(approved);
    if (!saveAsSuggestion) return { sop };
    const now = new Date().toISOString();
    const candidate: MemoryCandidate = {
      id: `candidate-${crypto.randomUUID()}`,
      version: 1,
      companyId: actor.companyId,
      type: "SOP",
      title: sop.title,
      statement: `${sop.purpose} ${sop.steps.map((step) => `${step.order}. ${step.action}`).join(" ")}`,
      rationale: "Make the approved Tuesday promotion repeatable for front desk staff.",
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
