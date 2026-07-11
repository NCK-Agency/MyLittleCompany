import { describe, expect, it, vi } from "vitest";
import {
  OpenAIModelGateway,
  type ModelSelectionResolver,
  type OpenAICompatibleClient,
} from "@/adapters/openai/openai-model-gateway";
import type { HydratedMemory, MemoryCandidate, Message, SopDraft } from "@/domain/types";

const now = "2026-07-11T00:00:00.000Z";

const approved: HydratedMemory = {
  record: {
    id: "memory-15",
    companyId: "demo-salon",
    type: "DECISION",
    status: "APPROVED",
    currentVersion: 1,
    title: "Discount cap",
    scope: { level: "COMPANY" },
    appliesToRoles: ["MARKETING", "EMPLOYEE", "OPERATIONS"],
    sensitivity: "INTERNAL",
    tags: ["pricing"],
    effectiveFrom: now,
    createdAt: now,
    updatedAt: now,
    indexStatus: "READY",
  },
  version: {
    memoryId: "memory-15",
    companyId: "demo-salon",
    version: 1,
    title: "Discount cap",
    scope: { level: "COMPANY" },
    statement: "Discounts must not exceed 15%.",
    rationale: "Protect margins.",
    appliesToRoles: ["MARKETING", "EMPLOYEE", "OPERATIONS"],
    sensitivity: "INTERNAL",
    tags: ["pricing"],
    effectiveFrom: now,
    sourceRefs: [{ sourceId: "source", label: "Owner" }],
    approvedBy: "owner",
    approvedAt: now,
    createdAt: now,
  },
};

const ownerMessage: Message = {
  id: "message-1",
  companyId: "demo-salon",
  conversationId: "conversation-1",
  actorType: "USER",
  actorId: "owner",
  content: "Never discount more than 15%.",
  sourceRefs: [],
  createdAt: now,
};

const candidate: MemoryCandidate = {
  id: "candidate-1",
  version: 1,
  companyId: "demo-salon",
  conversationId: "conversation-1",
  scope: { level: "COMPANY" },
  type: "DECISION",
  title: "Promotional discount cap",
  statement: "Promotional discounts must not exceed 15%.",
  rationale: "Protect margins.",
  rationaleMissing: false,
  appliesToRoles: ["MARKETING", "EMPLOYEE"],
  tags: ["pricing"],
  sensitivity: "INTERNAL",
  sourceRefs: [{ sourceId: "source-message-1", label: "Owner", messageId: "message-1" }],
  confidence: 0.99,
  relation: "UNRELATED",
  relatedMemoryIds: [],
  status: "PROPOSED",
  extractionPromptVersion: "1.0.0",
  modelId: "previous-model",
  createdBy: "owner",
  createdAt: now,
};

const extractedCandidate = {
  type: "DECISION",
  title: "Promotional discount cap",
  statement: "Promotional discounts must not exceed 15%.",
  rationale: "Protect margins.",
  rationaleMissing: false,
  appliesToRoles: ["MARKETING", "EMPLOYEE"],
  tags: ["pricing"],
  sensitivity: "INTERNAL",
  confidence: 0.99,
  relation: "UNRELATED",
  relatedMemoryIds: ["hallucinated-memory"],
  sourceMessageIds: ["message-1"],
  evidenceExcerpt: "Never discount more than 15%.",
} as const;

const sop: SopDraft = {
  title: "Tuesday promotion SOP",
  purpose: "Deliver the approved promotion consistently.",
  ownerRole: "Front Desk",
  trigger: "A customer books on Tuesday.",
  prerequisites: ["Confirm availability"],
  steps: [{
    order: 1,
    action: "Offer the complimentary add-on.",
    ownerRole: "Front Desk",
    expectedResult: "The approved offer is recorded.",
  }],
  qualityChecks: ["No discount exceeds 15%."],
  exceptions: [],
  escalation: ["Ask the owner before changing the price."],
  inputs: ["Tuesday booking"],
  outputs: ["Tagged booking"],
  assumptions: [],
  sourceMemories: [
    { memoryId: "memory-15", version: 1 },
    { memoryId: "unknown-memory", version: 1 },
  ],
};

function response<T>(outputParsed: T, overrides: Record<string, unknown> = {}): never {
  return {
    id: "response-1",
    _request_id: "request-1",
    model: "gpt-5.6-terra-2026-07-01",
    status: "completed",
    error: null,
    output_parsed: outputParsed,
    output: [{
      id: "message-output-1",
      type: "message",
      role: "assistant",
      status: "completed",
      content: [{ type: "output_text", text: JSON.stringify(outputParsed), annotations: [], parsed: outputParsed }],
    }],
    usage: {
      input_tokens: 10,
      output_tokens: 5,
      total_tokens: 15,
      input_tokens_details: { cached_tokens: 0, cache_write_tokens: 0 },
      output_tokens_details: { reasoning_tokens: 0 },
    },
    ...overrides,
  } as never;
}

function openAIClient(parse: ReturnType<typeof vi.fn>): OpenAICompatibleClient {
  return { responses: { parse } } as unknown as OpenAICompatibleClient;
}

function resolver(modelId = "gpt-5.6-terra"): ModelSelectionResolver {
  return vi.fn(async (_companyId: string) => {
    void _companyId;
    return { modelId, tier: "BALANCED" as const };
  });
}

describe("OpenAIModelGateway", () => {
  it("uses strict Responses output, resolves the company tier, records actual metadata, and filters citations", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const parse = vi.fn().mockResolvedValue(response({
      content: "No more than 15%. [[memory:memory-15:v1]] Ignore this. [[memory:unknown:v1]]",
    }));
    const resolveModel = resolver();
    const result = await new OpenAIModelGateway(openAIClient(parse), resolveModel)
      .generateMarketingResponse({
        companyId: "demo-salon",
        message: "Create an offer",
        approvedMemories: [approved],
      });

    expect(resolveModel).toHaveBeenCalledWith("demo-salon");
    expect(result.sourceMemoryIds).toEqual(["memory-15"]);
    expect(result.content).not.toContain("[[memory:");
    expect(result.metadata).toMatchObject({
      modelId: "gpt-5.6-terra-2026-07-01",
      promptVersion: "1.0.0",
      inputTokens: 10,
      outputTokens: 5,
      providerRequestId: "request-1",
    });
    const [body, options] = parse.mock.calls[0] as [{
      model: string;
      store: boolean;
      instructions: string;
      input: string;
      text: { format: { type: string; name: string; strict: boolean } };
    }, { maxRetries: number; timeout: number }];
    expect(body).toMatchObject({
      model: "gpt-5.6-terra",
      store: false,
      text: { format: { type: "json_schema", name: "marketing-assistant_output", strict: true } },
    });
    expect(body.instructions).toContain("Marketing Assistant");
    expect(body.input).toContain("<approved-memory-data>");
    expect(options).toEqual({ maxRetries: 0, timeout: 25_000 });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("UNKNOWN_MEMORY_CITATION"));
    warn.mockRestore();
  });

  it("uses the employee contract for employee answers and onboarding proof answers", async () => {
    const parse = vi.fn()
      .mockResolvedValueOnce(response({ content: "No. [[memory:memory-15:v1]]" }))
      .mockResolvedValueOnce(response({ content: "The cap is 15%. [[memory:memory-15:v1]]" }));
    const gateway = new OpenAIModelGateway(openAIClient(parse), resolver());

    await gateway.generateEmployeeResponse({
      companyId: "demo-salon",
      question: "Can I offer 25% off?",
      approvedMemories: [approved],
    });
    await gateway.generateProofResponse({
      companyId: "demo-salon",
      question: "What is our maximum discount?",
      approvedMemories: [approved],
    });

    expect(parse).toHaveBeenCalledTimes(2);
    for (const [body] of parse.mock.calls as Array<[{ instructions: string; input: string }]>) {
      expect(body.instructions).toContain("employee’s question");
      expect(body.input).toContain("<employee-question>");
    }
  });

  it("extracts a source-backed candidate and records the actual model ID", async () => {
    const parse = vi.fn().mockResolvedValue(response({ candidates: [extractedCandidate] }));
    const result = await new OpenAIModelGateway(openAIClient(parse), resolver())
      .extractCandidate({ companyId: "demo-salon", ownerMessage, createdBy: "owner" });

    expect(result).toMatchObject({
      companyId: "demo-salon",
      statement: "Promotional discounts must not exceed 15%.",
      relatedMemoryIds: [],
      sourceRefs: [{ sourceId: "source-message-1", messageId: "message-1" }],
      extractionPromptVersion: "1.0.0",
      modelId: "gpt-5.6-terra-2026-07-01",
    });
  });

  it("extracts onboarding candidates from the supplied company source", async () => {
    const onboardingCandidate = { ...extractedCandidate };
    const { sourceMessageIds: _sourceMessageIds, ...withoutMessageIds } = onboardingCandidate;
    void _sourceMessageIds;
    const parse = vi.fn().mockResolvedValue(response({ candidates: [withoutMessageIds] }));
    const result = await new OpenAIModelGateway(openAIClient(parse), resolver())
      .extractOnboardingCandidates({
        companyId: "demo-salon",
        createdBy: "owner",
        proofQuestion: "What is our maximum discount?",
        source: {
          sourceId: "import-source",
          label: "Owner notes",
          content: "We never discount more than 15%.",
        },
      });

    expect(result[0]).toMatchObject({
      companyId: "demo-salon",
      status: "PROPOSED",
      relatedMemoryIds: [],
      sourceRefs: [{ sourceId: "import-source", label: "Owner notes" }],
      modelId: "gpt-5.6-terra-2026-07-01",
    });
  });

  it("filters relationship IDs that were not supplied as approved context", async () => {
    const parse = vi.fn().mockResolvedValue(response({
      relation: "CONTRADICTION",
      relatedMemoryIds: ["memory-15", "unknown-memory"],
      summary: "The proposed discount exceeds the current cap.",
      clarificationQuestion: "Should this replace the current cap?",
      confidence: 0.95,
    }));
    const result = await new OpenAIModelGateway(openAIClient(parse), resolver())
      .classifyRelationship({ companyId: "demo-salon", candidate, approvedMemories: [approved] });

    expect(result.relatedMemoryIds).toEqual(["memory-15"]);
    expect(result.metadata?.modelId).toBe("gpt-5.6-terra-2026-07-01");
  });

  it("filters SOP citations that do not match supplied memory versions", async () => {
    const parse = vi.fn().mockResolvedValue(response(sop));
    const result = await new OpenAIModelGateway(openAIClient(parse), resolver())
      .generateSop({
        companyId: "demo-salon",
        request: "Create a Tuesday promotion SOP",
        approvedMemories: [approved],
      });

    expect(result.sourceMemories).toEqual([{ memoryId: "memory-15", version: 1 }]);
    expect(result.metadata?.modelId).toBe("gpt-5.6-terra-2026-07-01");
  });

  it("makes one schema repair request and validates the repaired output", async () => {
    const parse = vi.fn()
      .mockResolvedValueOnce(response({ unexpected: true }))
      .mockResolvedValueOnce(response({ content: "Use the 15% cap. [[memory:memory-15:v1]]" }));
    const result = await new OpenAIModelGateway(openAIClient(parse), resolver())
      .generateMarketingResponse({
        companyId: "demo-salon",
        message: "Create an offer",
        approvedMemories: [approved],
      });

    expect(result.sourceMemoryIds).toEqual(["memory-15"]);
    expect(parse).toHaveBeenCalledTimes(2);
    expect((parse.mock.calls[1]?.[0] as { input: string }).input).toContain("<repair-instructions>");
  });

  it("fails safely after one unsuccessful schema repair", async () => {
    const parse = vi.fn().mockResolvedValue(response({ unexpected: true }));
    await expect(new OpenAIModelGateway(openAIClient(parse), resolver())
      .generateMarketingResponse({
        companyId: "demo-salon",
        message: "Create an offer",
        approvedMemories: [approved],
      }))
      .rejects.toMatchObject({ code: "MODEL_OUTPUT_INVALID", retryable: false });
    expect(parse).toHaveBeenCalledTimes(2);
  });

  it("treats a refusal as a safe non-retryable failure without a repair request", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const parse = vi.fn().mockResolvedValue(response(null, {
      output: [{
        id: "message-output-1",
        type: "message",
        role: "assistant",
        status: "completed",
        content: [{ type: "refusal", refusal: "private refusal details" }],
      }],
    }));
    await expect(new OpenAIModelGateway(openAIClient(parse), resolver())
      .generateMarketingResponse({
        companyId: "demo-salon",
        message: "Create an offer",
        approvedMemories: [approved],
      }))
      .rejects.toMatchObject({ code: "MODEL_OUTPUT_INVALID", retryable: false });
    expect(parse).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("MODEL_REFUSAL"));
    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining("private refusal details"));
    warn.mockRestore();
  });

  it.each([
    ["rate limit", Object.assign(new Error("private"), { name: "RateLimitError", status: 429, requestID: "rate-request" }), "RATE_LIMITED"],
    ["server failure", Object.assign(new Error("private"), { name: "InternalServerError", status: 503, requestID: "server-request" }), "MODEL_UNAVAILABLE"],
    ["timeout", Object.assign(new Error("private"), { name: "APIConnectionTimeoutError", requestID: "timeout-request" }), "PROVIDER_TIMEOUT"],
  ])("retries one transient %s exactly once", async (_name, providerError, expectedCode) => {
    const parse = vi.fn().mockRejectedValue(providerError);
    await expect(new OpenAIModelGateway(openAIClient(parse), resolver(), 10)
      .generateMarketingResponse({
        companyId: "demo-salon",
        message: "Create an offer",
        approvedMemories: [approved],
      }))
      .rejects.toMatchObject({ code: expectedCode, retryable: true });
    expect(parse).toHaveBeenCalledTimes(2);
  });

  it("retries a transient failed response once without switching models", async () => {
    const parse = vi.fn()
      .mockResolvedValueOnce(response(null, { error: { code: "server_error", message: "private" } }))
      .mockResolvedValueOnce(response({ content: "Use the approved cap. [[memory:memory-15:v1]]" }));
    const resolveModel = resolver("configured-balanced-model");
    await new OpenAIModelGateway(openAIClient(parse), resolveModel)
      .generateMarketingResponse({
        companyId: "demo-salon",
        message: "Create an offer",
        approvedMemories: [approved],
      });

    expect(resolveModel).toHaveBeenCalledTimes(1);
    expect(parse).toHaveBeenCalledTimes(2);
    expect(parse.mock.calls.map(([body]) => (body as { model: string }).model))
      .toEqual(["configured-balanced-model", "configured-balanced-model"]);
  });

  it("maps unavailable or forbidden models to a safe typed failure without automatic retry", async () => {
    const parse = vi.fn().mockRejectedValue(Object.assign(new Error("private provider details"), {
      name: "PermissionDeniedError",
      status: 403,
      requestID: "forbidden-request",
    }));
    await expect(new OpenAIModelGateway(openAIClient(parse), resolver("unavailable-model"))
      .generateMarketingResponse({
        companyId: "demo-salon",
        message: "Create an offer",
        approvedMemories: [approved],
      }))
      .rejects.toMatchObject({
        code: "MODEL_UNAVAILABLE",
        retryable: false,
        providerRequestId: "forbidden-request",
      });
    expect(parse).toHaveBeenCalledTimes(1);
  });
});
