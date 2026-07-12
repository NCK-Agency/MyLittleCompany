import { candidateSchema, sopDraftSchema } from "@/domain/schemas";
import type { HydratedMemory, MemoryCandidate, Message, SopDraft } from "@/domain/types";
import type { ModelGateway } from "@/ports/model-gateway";

function pricingMemory(memories: HydratedMemory[]): HydratedMemory | undefined {
  return memories.find((memory) =>
    memory.version.tags.includes("pricing") || memory.version.statement.toLowerCase().includes("discount"),
  );
}

function discountCap(memory: HydratedMemory): string {
  return memory.version.statement.match(/\b\d{1,2}%/)?.[0] ?? "the approved limit";
}

export class FixtureModelGateway implements ModelGateway {
  async generateMarketingResponse(input: {
    message: string;
    conversation?: Message[];
    approvedMemories: HydratedMemory[];
  }): Promise<{ content: string; sourceMemoryIds: string[] }> {
    void input.conversation;
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
      const cap = discountCap(rule);
      return {
        content:
          `Recommended revision: Tuesday Signature Refresh — book any Tuesday color or cut service and receive a complimentary conditioning ritual. Keep the message warm and premium, with no discount above the approved ${cap} maximum.\n\nWhy it fits your company\nThe complimentary add-on protects the salon’s premium positioning while creating a clear reason to book on Tuesday.`,
        sourceMemoryIds: [rule.record.id],
      };
    }

    return {
      content:
        "Recommendation: Tuesday Reset — invite busy local professionals to reserve a quieter Tuesday appointment and include a complimentary consultation. The offer feels personal and premium without assuming a company discount policy that has not been approved.",
      sourceMemoryIds: input.approvedMemories.map((memory) => memory.record.id),
    };
  }

  async generateEmployeeResponse(input: {
    question: string;
    conversation?: Message[];
    approvedMemories: HydratedMemory[];
  }): Promise<{ content: string; sourceMemoryIds: string[] }> {
    void input.question;
    const rule = pricingMemory(input.approvedMemories);
    if (!rule) {
      return {
        content: "I could not find an approved company rule for this. Please ask the owner.",
        sourceMemoryIds: [],
      };
    }
    const cap = discountCap(rule);
    return {
      content: `No. The current approved promotion policy caps discounts at ${cap}. The salon prefers complimentary add-ons because they protect margins and premium positioning.`,
      sourceMemoryIds: [rule.record.id],
    };
  }

  async generateProofResponse(input: {
    question: string;
    approvedMemories: HydratedMemory[];
  }): Promise<{ content: string; sourceMemoryIds: string[] }> {
    const employee = await this.generateEmployeeResponse(input);
    if (employee.sourceMemoryIds.length > 0) return employee;
    const first = input.approvedMemories[0];
    if (!first) return employee;
    return {
      content: `Based on the company knowledge you just approved: ${first.version.statement}`,
      sourceMemoryIds: [first.record.id],
    };
  }

  async extractCandidate(input: {
    ownerMessage: Message;
    conversation?: Message[];
    createdBy: string;
  }): Promise<MemoryCandidate | null> {
    const messages = input.conversation ?? [input.ownerMessage];
    const ownerMessages = messages.filter((message) => message.actorType === "USER");
    const transcript = ownerMessages.map((message) => message.content).join("\n").toLowerCase();
    if (!transcript.includes("never discount more than 15%")) {
      return null;
    }
    const candidate: MemoryCandidate = {
      id: `candidate-${crypto.randomUUID()}`,
      version: 1,
      companyId: input.ownerMessage.companyId,
      conversationId: input.ownerMessage.conversationId,
      scope: { level: "COMPANY" },
      type: "DECISION",
      title: "Promotional discounts must not exceed 15%",
      statement:
        "Promotional discounts must not exceed 15%. Prefer complimentary add-ons over deeper discounts.",
      rationale: "Protect margins and maintain premium brand positioning.",
      rationaleMissing: false,
      appliesToRoles: ["MARKETING", "SALES", "FRONT_DESK", "EMPLOYEE", "OPERATIONS"],
      tags: ["pricing", "promotion"],
      sensitivity: "INTERNAL",
      sourceRefs: ownerMessages.map((message) => ({
          sourceId: `source-${message.id}`,
          label: "Tuesday campaign conversation",
          messageId: message.id,
          excerpt: message.content.slice(0, 300),
        })),
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

  async extractOnboardingCandidates(input: {
    companyId: string;
    createdBy: string;
    proofQuestion: string;
    source: { sourceId: string; label: string; content: string };
  }): Promise<MemoryCandidate[]> {
    const now = new Date().toISOString();
    const normalized = input.source.content.replace(/\s+/g, " ").trim();
    const discountSentence = normalized.match(/[^.!?]*(?:discount[^.!?]*\d{1,2}%|\d{1,2}%[^.!?]*discount)[^.!?]*[.!?]?/i)?.[0];
    const discountCap = discountSentence?.match(/\b\d{1,2}%/)?.[0];
    const discount = discountSentence && discountCap
      && /\b(?:never|must not|cannot|not exceed|maximum|cap(?:ped)?|at most|no more than)\b/i.test(discountSentence)
      ? { sentence: discountSentence.trim(), cap: discountCap }
      : null;
    const candidates: MemoryCandidate[] = [];
    if (discount) {
      const prefersAddOn = /prefer[^.]{0,100}(?:add-on|add on|complimentary|free)/i.test(normalized);
      candidates.push(candidateSchema.parse({
        id: `candidate-${crypto.randomUUID()}`,
        version: 1,
        companyId: input.companyId,
        scope: { level: "COMPANY" },
        type: "POLICY",
        title: `Promotional discounts must not exceed ${discount.cap}`,
        statement: `Promotional discounts must not exceed ${discount.cap}.${prefersAddOn ? " Prefer complimentary add-ons over deeper discounts." : ""}`,
        rationale: /premium|margin/i.test(normalized) ? "Protect margins and maintain premium positioning." : null,
        rationaleMissing: !/premium|margin/i.test(normalized),
        appliesToRoles: ["OWNER", "MARKETING", "SALES", "FRONT_DESK", "EMPLOYEE"],
        tags: ["pricing", "promotion"],
        sensitivity: "INTERNAL",
        sourceRefs: [{ sourceId: input.source.sourceId, label: input.source.label, excerpt: discount.sentence.slice(0, 300) }],
        confidence: 0.99,
        relation: "UNRELATED",
        relatedMemoryIds: [],
        status: "PROPOSED",
        extractionPromptVersion: "onboarding-1.0.0",
        modelId: "local-fixture-v1",
        createdBy: input.createdBy,
        createdAt: now,
      }));
    }
    const sentence = normalized.split(/(?<=[.!?])\s+/).find((value) =>
      /\b(?:we|our company|our customers|our brand)\b/i.test(value)
      && /\b(?:always|never|prefer|focus|serve|offer|policy|customers|brand)\b/i.test(value)
      && (!discount || !value.includes(discount.sentence)),
    );
    if (sentence) {
      candidates.push(candidateSchema.parse({
        id: `candidate-${crypto.randomUUID()}`,
        version: 1,
        companyId: input.companyId,
        scope: { level: "COMPANY" },
        type: /customer|serve/i.test(sentence) ? "CUSTOMER_INSIGHT" : /brand|voice|premium/i.test(sentence) ? "BRAND_RULE" : "COMPANY_FACT",
        title: sentence.replace(/^(we|our company)\s+/i, "").slice(0, 117),
        statement: sentence.slice(0, 2000),
        rationale: null,
        rationaleMissing: true,
        appliesToRoles: ["OWNER", "MARKETING", "OPERATIONS", "EMPLOYEE"],
        tags: ["onboarding"],
        sensitivity: "INTERNAL",
        sourceRefs: [{ sourceId: input.source.sourceId, label: input.source.label, excerpt: sentence.slice(0, 300) }],
        confidence: 0.85,
        relation: "UNRELATED",
        relatedMemoryIds: [],
        status: "PROPOSED",
        extractionPromptVersion: "onboarding-1.0.0",
        modelId: "local-fixture-v1",
        createdBy: input.createdBy,
        createdAt: now,
      }));
    }
    void input.proofQuestion;
    return candidates;
  }

  async classifyRelationship(input: {
    candidate: MemoryCandidate;
    approvedMemories: HydratedMemory[];
  }): Promise<{
    relation: MemoryCandidate["relation"];
    relatedMemoryIds: string[];
    summary: string;
    clarificationQuestion: string | null;
    confidence: number;
  }> {
    void input.approvedMemories;
    return {
      relation: input.candidate.relation,
      relatedMemoryIds: input.candidate.relatedMemoryIds,
      summary: "Local fixture relationship classification.",
      clarificationQuestion: null,
      confidence: 1,
    };
  }

  async generateSop(input: { request: string; conversation?: Message[]; approvedMemories: HydratedMemory[] }): Promise<SopDraft> {
    void input.conversation;
    const rule = pricingMemory(input.approvedMemories);
    if (!rule) throw new Error("NO_APPROVED_CONTEXT");
    const cap = discountCap(rule);
    const isTuesdayPromotion = /tuesday|promotion/i.test(input.request);
    const title = isTuesdayPromotion ? "Tuesday Signature Refresh SOP" : "Requested Operations SOP";
    const purpose = isTuesdayPromotion
      ? `Follow the owner's request — ${input.request} — while protecting the salon’s premium positioning.`
      : `Turn this owner request into repeatable work: ${input.request}`;
    return sopDraftSchema.parse({
      title,
      purpose,
      ownerRole: "Front Desk",
      trigger: "A customer books an eligible Tuesday appointment.",
      prerequisites: ["Confirm Tuesday availability", "Confirm the complimentary add-on is available"],
      steps: [
        { order: 1, action: "Confirm the appointment is scheduled for Tuesday.", ownerRole: "Front Desk", expectedResult: "The booking is eligible." },
        { order: 2, action: `Offer the complimentary conditioning ritual; do not offer more than ${cap} off.`, ownerRole: "Front Desk", expectedResult: "The customer receives the approved offer." },
        { order: 3, action: "Record the promotion on the booking and brief the stylist.", ownerRole: "Front Desk", expectedResult: "The team can deliver the offer consistently." },
      ],
      qualityChecks: ["Offer language is warm and never pushy", `No discount exceeds ${cap}`],
      exceptions: ["Do not combine with another promotion without owner approval"],
      escalation: ["Ask the owner before changing price or substituting the add-on"],
      inputs: ["Tuesday booking", "Available conditioning ritual"],
      outputs: ["Tagged booking", "Delivered complimentary add-on"],
      assumptions: [],
      sourceMemories: [{ memoryId: rule.record.id, version: rule.version.version }],
    });
  }
}
