import { describe, expect, it, vi } from "vitest";
import { NO_APPROVED_COMPANY_RULE } from "@/domain/grounding";
import { AssistantService } from "@/services/assistant-service";
import { employeeActor } from "@/server/actors";

describe("AssistantService grounding", () => {
  it("replaces an unsupported employee claim when no valid citation survives", async () => {
    const retrieval = { retrieve: vi.fn().mockResolvedValue([]) };
    const model = {
      generateEmployeeResponse: vi.fn().mockResolvedValue({
        content: "The company allows an 80% discount.",
        sourceMemoryIds: ["unknown-memory"],
      }),
    };
    const service = new AssistantService(retrieval as never, model as never);

    await expect(service.answerEmployee("What discount can I offer?", employeeActor())).resolves.toEqual({
      answer: NO_APPROVED_COMPANY_RULE,
      groundingStatus: "NO_APPROVED_CONTEXT",
      sourceMemories: [],
    });
  });
});
