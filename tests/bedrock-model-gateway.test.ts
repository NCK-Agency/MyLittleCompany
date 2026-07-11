import type { ConverseCommandOutput } from "@aws-sdk/client-bedrock-runtime";
import { describe, expect, it, vi } from "vitest";
import { BedrockModelGateway } from "@/adapters/aws/bedrock-model-gateway";
import type { HydratedMemory, Message } from "@/domain/types";

function output(text: string, requestId = "request-1"): ConverseCommandOutput {
  return {
    $metadata: { requestId },
    output: { message: { role: "assistant", content: [{ text }] } },
    usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
    stopReason: "end_turn",
    metrics: { latencyMs: 10 },
  };
}

const approved: HydratedMemory = {
  record: {
    id: "memory-15", companyId: "demo-salon", type: "DECISION", status: "APPROVED",
    currentVersion: 1, title: "Discount cap", scope: { level: "COMPANY" }, appliesToRoles: ["MARKETING", "EMPLOYEE"],
    sensitivity: "INTERNAL", tags: ["pricing"], effectiveFrom: "2026-07-11T00:00:00.000Z",
    createdAt: "2026-07-11T00:00:00.000Z", updatedAt: "2026-07-11T00:00:00.000Z", indexStatus: "READY",
  },
  version: {
    memoryId: "memory-15", companyId: "demo-salon", version: 1, title: "Discount cap", scope: { level: "COMPANY" },
    statement: "Discounts must not exceed 15%.", rationale: "Protect margins.",
    appliesToRoles: ["MARKETING", "EMPLOYEE"], sensitivity: "INTERNAL", tags: ["pricing"],
    effectiveFrom: "2026-07-11T00:00:00.000Z", sourceRefs: [{ sourceId: "source", label: "Owner" }],
    approvedBy: "owner", approvedAt: "2026-07-11T00:00:00.000Z", createdAt: "2026-07-11T00:00:00.000Z",
  },
};

const ownerMessage: Message = {
  id: "message-1", companyId: "demo-salon", conversationId: "conversation-1",
  actorType: "USER", actorId: "owner", content: "Never discount more than 15%.",
  sourceRefs: [], createdAt: "2026-07-11T00:00:00.000Z",
};

describe("BedrockModelGateway", () => {
  it("records prompt metadata and removes unknown citations", async () => {
    const send = vi.fn().mockResolvedValue(output(
      "No more than 15%. [[memory:memory-15:v1]] Ignore this citation. [[memory:unknown:v1]]",
    ));
    const result = await new BedrockModelGateway({ send }, "amazon.nova-lite-v1:0")
      .generateMarketingResponse({ message: "Create an offer", approvedMemories: [approved] });
    expect(result.sourceMemoryIds).toEqual(["memory-15"]);
    expect(result.content).not.toContain("[[memory:");
    expect(result.metadata).toMatchObject({
      modelId: "amazon.nova-lite-v1:0", promptVersion: "1.0.0",
      inputTokens: 10, outputTokens: 5, providerRequestId: "request-1",
    });
  });

  it("repairs invalid structured output exactly once", async () => {
    const valid = JSON.stringify({ candidates: [{
      type: "DECISION", title: "Promotional discount cap",
      statement: "Promotional discounts must not exceed 15%.", rationale: "Protect margins.",
      rationaleMissing: false, appliesToRoles: ["MARKETING", "EMPLOYEE"], tags: ["pricing"],
      sensitivity: "INTERNAL", confidence: 0.99, relation: "UNRELATED", relatedMemoryIds: [],
      sourceMessageIds: ["message-1"], evidenceExcerpt: "Never discount more than 15%.",
    }] });
    const send = vi.fn()
      .mockResolvedValueOnce(output("not-json"))
      .mockResolvedValueOnce(output(valid, "request-2"));
    const result = await new BedrockModelGateway({ send }, "amazon.nova-lite-v1:0")
      .extractCandidate({ ownerMessage, createdBy: "owner" });
    expect(result).toMatchObject({
      statement: "Promotional discounts must not exceed 15%.",
      extractionPromptVersion: "1.0.0",
      modelId: "amazon.nova-lite-v1:0",
    });
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("fails safely after one unsuccessful repair", async () => {
    const send = vi.fn().mockResolvedValue(output("still-not-json"));
    await expect(new BedrockModelGateway({ send }, "amazon.nova-lite-v1:0")
      .extractCandidate({ ownerMessage, createdBy: "owner" }))
      .rejects.toMatchObject({ code: "MODEL_OUTPUT_INVALID" });
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("extracts a source-backed onboarding candidate list", async () => {
    const send = vi.fn().mockResolvedValue(output(JSON.stringify({ candidates: [{
      type: "POLICY", title: "Promotional discount cap",
      statement: "Promotional discounts must not exceed 15%.", rationale: null,
      rationaleMissing: true, appliesToRoles: ["OWNER", "MARKETING"], tags: ["pricing"],
      sensitivity: "INTERNAL", confidence: 0.98, relation: "UNRELATED", relatedMemoryIds: [],
      evidenceExcerpt: "We never discount more than 15%.",
    }] })));
    const result = await new BedrockModelGateway({ send }, "amazon.nova-lite-v1:0")
      .extractOnboardingCandidates({
        companyId: "demo-salon",
        createdBy: "owner",
        proofQuestion: "What is our maximum discount?",
        source: { sourceId: "import-source", label: "Owner notes", content: "We never discount more than 15%." },
      });

    expect(result[0]).toMatchObject({
      statement: "Promotional discounts must not exceed 15%.",
      status: "PROPOSED",
      sourceRefs: [{ sourceId: "import-source", label: "Owner notes" }],
      extractionPromptVersion: "1.0.0",
    });
  });

  it("returns a retryable timeout error", async () => {
    const send = vi.fn((_command, options?: { abortSignal?: AbortSignal }) => new Promise<ConverseCommandOutput>((_resolve, reject) => {
      options?.abortSignal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
    }));
    await expect(new BedrockModelGateway({ send }, "amazon.nova-lite-v1:0", 1)
      .generateMarketingResponse({ message: "Offer", approvedMemories: [approved] }))
      .rejects.toMatchObject({ code: "PROVIDER_TIMEOUT", retryable: true });
  });

  it("maps an unavailable model to a safe typed error", async () => {
    const error = Object.assign(new Error("private provider message"), { name: "ResourceNotFoundException" });
    const send = vi.fn().mockRejectedValue(error);
    await expect(new BedrockModelGateway({ send }, "missing-model")
      .generateMarketingResponse({ message: "Offer", approvedMemories: [] }))
      .rejects.toMatchObject({ code: "MODEL_UNAVAILABLE", retryable: false });
  });
});
