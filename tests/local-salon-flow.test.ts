import { beforeEach, describe, expect, it } from "vitest";
import { resetDemoState } from "@/adapters/local/demo-state";
import { employeeActor, ownerActor } from "@/server/actors";
import { assistantService, conversationService, memoryService, sopService } from "@/server/container";

describe("local salon flow", () => {
  beforeEach(() => resetDemoState());

  it("keeps a suggestion non-authoritative until owner approval, then reuses it", async () => {
    const conversation = await conversationService.create({ assistantRole: "MARKETING", title: "Tuesday promotion" }, ownerActor());
    const result = await conversationService.send(conversation.id, {
      content: "We never discount more than 15%. We prefer offering a free add-on because we want to maintain a premium image.",
      idempotencyKey: "rule-message-0001",
    }, ownerActor());
    const candidate = result.suggestedKnowledge[0];
    expect(candidate?.status).toBe("PROPOSED");
    expect((await assistantService.answerEmployee("Can I give a customer 25% off?", employeeActor())).groundingStatus).toBe("NO_APPROVED_CONTEXT");

    const memory = await memoryService.approveCandidate(candidate.id, candidate.version, ownerActor());
    expect(memory.record.indexStatus).toBe("READY");
    const answer = await assistantService.answerEmployee("Can I give a customer 25% off?", employeeActor());
    expect(answer.groundingStatus).toBe("GROUNDED");
    expect(answer.answer).toContain("15%");
    expect(answer.sourceMemories[0]?.memoryId).toBe(memory.record.id);

    const sop = await sopService.generate(ownerActor(), true);
    expect(sop.sop.sourceMemories[0]?.memoryId).toBe(memory.record.id);
    expect(sop.candidate?.status).toBe("PROPOSED");
  });

  it("prevents an employee from approving company knowledge", async () => {
    const conversation = await conversationService.create({ assistantRole: "MARKETING", title: "Tuesday" }, ownerActor());
    const result = await conversationService.send(conversation.id, {
      content: "We never discount more than 15%. We prefer offering a free add-on because we want to maintain a premium image.",
      idempotencyKey: "rule-message-0002",
    }, ownerActor());
    await expect(memoryService.approveCandidate(result.suggestedKnowledge[0].id, 1, employeeActor())).rejects.toThrow("FORBIDDEN");
  });

  it("does not duplicate a message with the same idempotency key", async () => {
    const conversation = await conversationService.create({ assistantRole: "MARKETING", title: "Tuesday" }, ownerActor());
    const input = { content: "Tuesdays are quiet. Create a promotion.", idempotencyKey: "same-message-key" };
    await conversationService.send(conversation.id, input, ownerActor());
    const duplicate = await conversationService.send(conversation.id, input, ownerActor());
    expect(duplicate.assistantMessage).toBeNull();
    expect(await conversationService.listMessages(conversation.id, ownerActor())).toHaveLength(2);
  });
});
