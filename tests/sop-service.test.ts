import { describe, expect, it, vi } from "vitest";
import { createDemoState } from "@/adapters/local/demo-state";
import { ownerActor } from "@/server/actors";
import { SopService } from "@/services/sop-service";

describe("SopService grounding", () => {
  it("refuses to save a source-less SOP suggestion", async () => {
    const retrieval = { retrieve: vi.fn().mockResolvedValue([]) };
    const model = { generateSop: vi.fn().mockResolvedValue({
      title: "Unsupported SOP",
      purpose: "Do work without an approved source.",
      ownerRole: "Operations",
      trigger: "A request arrives.",
      prerequisites: [],
      steps: [{ order: 1, action: "Act on the unsupported rule.", ownerRole: "Operations", expectedResult: "Work is complete." }],
      qualityChecks: [],
      exceptions: [],
      escalation: [],
      inputs: [],
      outputs: [],
      assumptions: [],
      sourceMemories: [{ memoryId: "unknown-memory", version: 1 }],
    }) };
    const memories = { createCandidate: vi.fn() };
    const service = new SopService(retrieval as never, model as never, memories as never);

    await expect(service.generate(ownerActor(), true)).rejects.toThrow("NO_APPROVED_CONTEXT");
    expect(memories.createCandidate).not.toHaveBeenCalled();
  });

  it("records the actual model and prompt version on a saved SOP suggestion", async () => {
    const approved = createDemoState().memories[0]!;
    const retrieval = { retrieve: vi.fn().mockResolvedValue([approved]) };
    const model = { generateSop: vi.fn().mockResolvedValue({
      title: "Supported SOP",
      purpose: "Repeat approved company work.",
      ownerRole: "Operations",
      trigger: "A request arrives.",
      prerequisites: [],
      steps: [{ order: 1, action: "Follow the approved rule.", ownerRole: "Operations", expectedResult: "Work is complete." }],
      qualityChecks: [],
      exceptions: [],
      escalation: [],
      inputs: [],
      outputs: [],
      assumptions: [],
      sourceMemories: [{ memoryId: approved.record.id, version: approved.version.version }],
      metadata: {
        modelId: "gpt-5.6-terra-2026-07-01",
        promptVersion: "1.0.0",
        latencyMs: 42,
      },
    }) };
    const memories = { createCandidate: vi.fn().mockImplementation((candidate) => Promise.resolve(candidate)) };
    const service = new SopService(retrieval as never, model as never, memories as never);

    const result = await service.generate(ownerActor(), true);

    expect(result.candidate).toMatchObject({
      modelId: "gpt-5.6-terra-2026-07-01",
      extractionPromptVersion: "1.0.0",
    });
  });
});
