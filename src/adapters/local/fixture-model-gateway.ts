import { candidateSchema, sopDraftSchema } from "@/domain/schemas";
import type { HydratedMemory, MemoryCandidate, Message, SopDraft } from "@/domain/types";
import type { ModelGateway } from "@/ports/model-gateway";

function pricingMemory(memories: HydratedMemory[]): HydratedMemory | undefined {
  return memories.find((memory) =>
    memory.version.statement.toLowerCase().includes("15%"),
  );
}

export class FixtureModelGateway implements ModelGateway {
  async generateMarketingResponse(input: {
    message: string;
    approvedMemories: HydratedMemory[];
  }): Promise<{ content: string; sourceMemoryIds: string[] }> {
    const rule = pricingMemory(input.approvedMemories);
    const normalized = input.message.toLowerCase();

    if (normalized.includes("never discount more than 15%")) {
      return {
        content:
          "Understood. I’ll treat the 15% maximum and preference for complimentary add-ons as suggested company knowledge until you approve it. I won’t use it as company policy yet.",
        sourceMemoryIds: [],
      };
    }

    if (rule) {
      return {
        content:
          "Recommended revision: Tuesday Signature Refresh — book any Tuesday color or cut service and receive a complimentary conditioning ritual. Keep the message warm and premium, with no discount above the approved 15% maximum.\n\nWhy it fits your company\nThe complimentary add-on protects the salon’s premium positioning while creating a clear reason to book on Tuesday.",
        sourceMemoryIds: [rule.record.id],
      };
    }

    return {
      content:
        "Recommendation: Tuesday Reset — invite busy local professionals to reserve a quieter Tuesday appointment and include a complimentary consultation. The offer feels personal and premium without assuming a company discount policy that has not been approved.",
      sourceMemoryIds: input.approvedMemories.map((memory) => memory.record.id),
    };
  }

  async extractCandidate(input: {
    ownerMessage: Message;
    createdBy: string;
  }): Promise<MemoryCandidate | null> {
    if (!input.ownerMessage.content.toLowerCase().includes("never discount more than 15%")) {
      return null;
    }
    const candidate: MemoryCandidate = {
      id: `candidate-${crypto.randomUUID()}`,
      version: 1,
      companyId: input.ownerMessage.companyId,
      conversationId: input.ownerMessage.conversationId,
      type: "DECISION",
      title: "Promotional discounts must not exceed 15%",
      statement:
        "Promotional discounts must not exceed 15%. Prefer complimentary add-ons over deeper discounts.",
      rationale: "Protect margins and maintain premium brand positioning.",
      rationaleMissing: false,
      appliesToRoles: ["MARKETING", "SALES", "FRONT_DESK", "EMPLOYEE", "OPERATIONS"],
      tags: ["pricing", "promotion"],
      sensitivity: "INTERNAL",
      sourceRefs: [
        {
          sourceId: `source-${input.ownerMessage.id}`,
          label: "Tuesday campaign conversation",
          messageId: input.ownerMessage.id,
          excerpt: input.ownerMessage.content.slice(0, 300),
        },
      ],
      confidence: 0.99,
      relation: "UNRELATED",
      relatedMemoryIds: [],
      status: "PROPOSED",
      extractionPromptVersion: "1.0.0",
      modelId: "local-fixture-v1",
      createdBy: input.createdBy,
      createdAt: input.ownerMessage.createdAt,
    };
    return candidateSchema.parse(candidate);
  }

  async generateSop(approvedMemories: HydratedMemory[]): Promise<SopDraft> {
    const rule = pricingMemory(approvedMemories);
    if (!rule) throw new Error("NO_APPROVED_CONTEXT");
    return sopDraftSchema.parse({
      title: "Tuesday Signature Refresh SOP",
      purpose: "Run the approved Tuesday promotion consistently while protecting the salon’s premium positioning.",
      ownerRole: "Front Desk",
      trigger: "A customer books an eligible Tuesday appointment.",
      prerequisites: ["Confirm Tuesday availability", "Confirm the complimentary add-on is available"],
      steps: [
        { order: 1, action: "Confirm the appointment is scheduled for Tuesday.", ownerRole: "Front Desk", expectedResult: "The booking is eligible." },
        { order: 2, action: "Offer the complimentary conditioning ritual; do not offer more than 15% off.", ownerRole: "Front Desk", expectedResult: "The customer receives the approved offer." },
        { order: 3, action: "Record the promotion on the booking and brief the stylist.", ownerRole: "Front Desk", expectedResult: "The team can deliver the offer consistently." },
      ],
      qualityChecks: ["Offer language is warm and never pushy", "No discount exceeds 15%"],
      exceptions: ["Do not combine with another promotion without owner approval"],
      escalation: ["Ask the owner before changing price or substituting the add-on"],
      inputs: ["Tuesday booking", "Available conditioning ritual"],
      outputs: ["Tagged booking", "Delivered complimentary add-on"],
      assumptions: [],
      sourceMemories: [{ memoryId: rule.record.id, version: rule.version.version }],
    });
  }
}
