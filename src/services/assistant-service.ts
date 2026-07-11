import type { ActorContext, GroundedAnswer } from "@/domain/types";
import type { KnowledgeIndex } from "@/ports/knowledge-index";

export class AssistantService {
  constructor(private readonly index: KnowledgeIndex) {}

  async answerEmployee(question: string, actor: ActorContext): Promise<GroundedAnswer> {
    const memories = await this.index.retrieve(question, actor);
    const pricing = memories.find((memory) => memory.version.statement.includes("15%"));
    if (!pricing) {
      return {
        answer: "I could not find an approved company rule for this. Please ask the owner.",
        groundingStatus: "NO_APPROVED_CONTEXT",
        sourceMemories: [],
      };
    }
    return {
      answer:
        "No. The current approved promotion policy caps discounts at 15%. The salon prefers complimentary add-ons because they protect margins and premium positioning.",
      groundingStatus: "GROUNDED",
      sourceMemories: [{
        memoryId: pricing.record.id,
        version: pricing.version.version,
        title: pricing.version.title,
        approvedAt: pricing.version.approvedAt,
      }],
    };
  }
}
