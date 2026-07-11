import { describe, expect, it, vi } from "vitest";
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
});
