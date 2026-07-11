import { describe, expect, it } from "vitest";
import type { MemoryCandidate } from "@/domain/types";
import { convertMlcMessage, readComposerText, type MlcUiMessage } from "@/components/assistant-ui/mlc-message-adapter";

const candidate: MemoryCandidate = {
  id: "candidate-1",
  version: 1,
  companyId: "company-1",
  conversationId: "conversation-1",
  scope: { level: "COMPANY" },
  type: "DECISION",
  title: "Promotional discounts must not exceed 15%",
  statement: "Promotional discounts must not exceed 15%.",
  rationale: "Protect the salon's premium positioning.",
  rationaleMissing: false,
  appliesToRoles: ["MARKETING", "SALES", "FRONT_DESK"],
  tags: ["pricing"],
  sensitivity: "INTERNAL",
  sourceRefs: [{ sourceId: "source-1", label: "Tuesday campaign conversation" }],
  confidence: 0.99,
  relation: "UNRELATED",
  relatedMemoryIds: [],
  status: "PROPOSED",
  extractionPromptVersion: "v1",
  modelId: "fixture",
  createdBy: "owner-1",
  createdAt: "2026-07-11T00:00:00.000Z",
};

describe("MLC assistant-ui message adapter", () => {
  it("converts approved sources and knowledge into named assistant data parts", () => {
    const message: MlcUiMessage = {
      id: "message-1",
      role: "assistant",
      createdAt: "2026-07-11T00:00:00.000Z",
      text: "Here is the revised promotion.",
      sources: [{ sourceId: "memory-1", label: "15% promotion rule" }],
      candidate,
    };

    const converted = convertMlcMessage(message);

    expect(converted.role).toBe("assistant");
    expect(converted.content).toEqual([
      { type: "text", text: "Here is the revised promotion." },
      { type: "data", name: "mlc-sources", data: message.sources },
      { type: "data", name: "mlc-knowledge-candidate", data: candidate },
    ]);
  });

  it("reads only text content from an assistant-ui composer submission", () => {
    expect(readComposerText([
      { type: "text", text: "First line" },
      { type: "data", text: undefined },
      { type: "text", text: "Second line" },
    ])).toBe("First line\nSecond line");
  });
});
