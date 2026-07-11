import type { ActorContext, GroundedAnswer, KnowledgeScope } from "@/domain/types";
import type { ModelGateway } from "@/ports/model-gateway";
import type { MemoryRetrievalService } from "./memory-retrieval-service";

export class AssistantService {
  constructor(
    private readonly retrieval: MemoryRetrievalService,
    private readonly model: ModelGateway,
  ) {}

  async answerEmployee(
    question: string,
    actor: ActorContext,
    scope: KnowledgeScope = { level: "COMPANY" },
  ): Promise<GroundedAnswer> {
    const memories = await this.retrieval.retrieve(question, actor, ["EMPLOYEE", "FRONT_DESK"], scope);
    const generated = await this.model.generateEmployeeResponse({ question, approvedMemories: memories });
    const sources = generated.sourceMemoryIds.flatMap((id) => {
      const memory = memories.find((item) => item.record.id === id);
      return memory ? [{
        memoryId: memory.record.id,
        version: memory.version.version,
        title: memory.version.title,
        approvedAt: memory.version.approvedAt,
      }] : [];
    });
    if (sources.length === 0) {
      return {
        answer: generated.content,
        groundingStatus: "NO_APPROVED_CONTEXT",
        sourceMemories: [],
      };
    }
    return {
      answer: generated.content,
      groundingStatus: "GROUNDED",
      sourceMemories: sources,
    };
  }
}
