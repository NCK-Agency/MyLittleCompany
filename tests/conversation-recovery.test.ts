import { beforeEach, describe, expect, it, vi } from "vitest";
import { LocalConversationRepository } from "@/adapters/local/conversation-repository";
import { createDemoState, resetDemoState } from "@/adapters/local/demo-state";
import { LocalSourceRepository } from "@/adapters/local/source-repository";
import { appError } from "@/domain/errors";
import { ownerActor } from "@/server/actors";
import { ConversationService } from "@/services/conversation-service";

beforeEach(() => resetDemoState());

function serviceWith(model: Record<string, unknown>, approved: unknown[] = []): {
  service: ConversationService;
  conversations: LocalConversationRepository;
} {
  const conversations = new LocalConversationRepository();
  const retrieval = { retrieve: vi.fn().mockResolvedValue(approved) };
  const suggestions = { suggestFromConversation: vi.fn().mockResolvedValue(null) };
  return {
    service: new ConversationService(
      conversations,
      retrieval as never,
      model as never,
      new LocalSourceRepository(),
      suggestions as never,
    ),
    conversations,
  };
}

describe("ConversationService recovery", () => {
  it("does not persist a failed provider turn and safely reuses its retry key", async () => {
    const generateMarketingResponse = vi.fn()
      .mockRejectedValueOnce(appError("MODEL_UNAVAILABLE", true))
      .mockResolvedValueOnce({ content: "A live promotion.", sourceMemoryIds: [] });
    const { service, conversations } = serviceWith({ generateMarketingResponse });
    const conversation = await service.create({ assistantRole: "MARKETING", title: "Recovery" }, ownerActor());
    const input = { content: "Create a Tuesday promotion.", idempotencyKey: "stable-retry-key" };

    await expect(service.send(conversation.id, input, ownerActor()))
      .rejects.toMatchObject({ code: "MODEL_UNAVAILABLE", retryable: true });
    await expect(conversations.listMessages(conversation.id, ownerActor().companyId)).resolves.toEqual([]);

    const recovered = await service.send(conversation.id, input, ownerActor());
    expect(recovered.assistantMessage?.content).toBe("A live promotion.");
    expect(await conversations.listMessages(conversation.id, ownerActor().companyId)).toHaveLength(2);
    expect(generateMarketingResponse).toHaveBeenCalledTimes(2);
  });

  it("rejects an Operations draft with no validated approved source before persisting the turn", async () => {
    const generateSop = vi.fn().mockResolvedValue({
      title: "Unsupported SOP",
      purpose: "Act without approved knowledge.",
      ownerRole: "Operations",
      trigger: "A request arrives.",
      prerequisites: [],
      steps: [{ order: 1, action: "Act.", ownerRole: "Operations", expectedResult: "Done." }],
      qualityChecks: [],
      exceptions: [],
      escalation: [],
      inputs: [],
      outputs: [],
      assumptions: [],
      sourceMemories: [],
    });
    const { service, conversations } = serviceWith({ generateSop });
    const conversation = await service.create({ assistantRole: "OPERATIONS", title: "Grounding" }, ownerActor());

    await expect(service.send(conversation.id, {
      content: "Create an SOP.",
      idempotencyKey: "source-less-sop",
    }, ownerActor())).rejects.toThrow("NO_APPROVED_CONTEXT");
    await expect(conversations.listMessages(conversation.id, ownerActor().companyId)).resolves.toEqual([]);
  });

  it("rejects reuse of an idempotency key with different message content", async () => {
    const generateMarketingResponse = vi.fn().mockResolvedValue({
      content: "A live promotion.",
      sourceMemoryIds: [],
    });
    const { service, conversations } = serviceWith({ generateMarketingResponse });
    const conversation = await service.create({ assistantRole: "MARKETING", title: "Idempotency" }, ownerActor());

    await service.send(conversation.id, {
      content: "Create the first promotion.",
      idempotencyKey: "one-request-key",
    }, ownerActor());
    await expect(service.send(conversation.id, {
      content: "Attach a different request to the same key.",
      idempotencyKey: "one-request-key",
    }, ownerActor())).rejects.toThrow("CONFLICT");

    expect(generateMarketingResponse).toHaveBeenCalledTimes(1);
    expect(await conversations.listMessages(conversation.id, ownerActor().companyId)).toHaveLength(2);
  });

  it("replays the stored structured SOP without regenerating it", async () => {
    const approved = createDemoState().memories[0]!;
    const generatedSop = {
      title: "Stored SOP",
      purpose: "Repeat approved work.",
      ownerRole: "Operations",
      trigger: "A request arrives.",
      prerequisites: [],
      steps: [{ order: 1, action: "Follow the source.", ownerRole: "Operations", expectedResult: "Done." }],
      qualityChecks: [],
      exceptions: [],
      escalation: [],
      inputs: [],
      outputs: [],
      assumptions: [],
      sourceMemories: [{ memoryId: approved.record.id, version: approved.version.version }],
      metadata: { modelId: "gpt-5.6-terra", promptVersion: "1.0.0", latencyMs: 10 },
    };
    const generateSop = vi.fn().mockResolvedValue(generatedSop);
    const { service, conversations } = serviceWith({ generateSop }, [approved]);
    const conversation = await service.create({ assistantRole: "OPERATIONS", title: "Replay" }, ownerActor());
    const input = { content: "Create the approved SOP.", idempotencyKey: "replay-sop-key" };

    const first = await service.send(conversation.id, input, ownerActor());
    const replay = await service.send(conversation.id, input, ownerActor());

    expect(first.sop?.title).toBe("Stored SOP");
    expect(replay.sop).toEqual(first.sop);
    expect(replay.assistantMessage?.sop).toEqual(first.sop);
    expect(generateSop).toHaveBeenCalledTimes(1);
    expect(await conversations.listMessages(conversation.id, ownerActor().companyId)).toHaveLength(2);
  });
});
