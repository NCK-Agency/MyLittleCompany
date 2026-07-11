import { beforeEach, describe, expect, it } from "vitest";
import { LocalConversationRepository } from "@/adapters/local/conversation-repository";
import { getDemoState, resetDemoState } from "@/adapters/local/demo-state";
import type { Conversation, Message } from "@/domain/types";
import { ownerActor } from "@/server/actors";
import { conversationService, memoryService } from "@/server/container";

const ownerStatement = "We never discount more than 15%. We prefer offering a free add-on because we want to maintain a premium image.";

describe("hardened local repository boundaries", () => {
  beforeEach(() => resetDemoState());

  it("makes concurrent approval idempotent and creates one version with atomic audits", async () => {
    const conversation = await conversationService.create({ assistantRole: "MARKETING", title: "Pricing" }, ownerActor());
    const sent = await conversationService.send(conversation.id, {
      content: ownerStatement,
      idempotencyKey: "concurrent-approval-message",
    }, ownerActor());
    const candidate = sent.suggestedKnowledge[0];
    const before = getDemoState().memories.length;

    const [first, second] = await Promise.all([
      memoryService.approveCandidate(candidate.id, candidate.version, ownerActor()),
      memoryService.approveCandidate(candidate.id, candidate.version, ownerActor()),
    ]);

    expect(second.record.id).toBe(first.record.id);
    expect(getDemoState().memories).toHaveLength(before + 1);
    expect(getDemoState().auditEvents.map((event) => event.action)).toEqual([
      "CANDIDATE_CREATED",
      "CANDIDATE_APPROVED",
      "MEMORY_VERSION_CREATED",
      "MEMORY_INDEX_READY",
    ]);
  });

  it("rejects stale candidate edits", async () => {
    const conversation = await conversationService.create({ assistantRole: "MARKETING", title: "Pricing" }, ownerActor());
    const sent = await conversationService.send(conversation.id, {
      content: ownerStatement,
      idempotencyKey: "stale-candidate-message",
    }, ownerActor());
    const candidate = sent.suggestedKnowledge[0];
    await expect(memoryService.updateCandidate(candidate.id, {
      expectedCandidateVersion: 99,
      title: candidate.title,
      statement: candidate.statement,
      rationale: candidate.rationale,
      appliesToRoles: candidate.appliesToRoles,
      tags: candidate.tags,
    }, ownerActor())).rejects.toThrow("STALE_WRITE");
  });

  it("scopes message idempotency by company and conversation", async () => {
    const repository = new LocalConversationRepository();
    const now = new Date().toISOString();
    const conversations: Conversation[] = ["one", "two"].map((id) => ({
      id, companyId: "demo-salon", title: id, assistantRole: "MARKETING",
      scope: { level: "COMPANY" },
      createdBy: "owner", createdAt: now, updatedAt: now,
    }));
    for (const conversation of conversations) await repository.create(conversation);
    const makeMessage = (conversationId: string): Message => ({
      id: `message-${conversationId}`, companyId: "demo-salon", conversationId,
      actorType: "USER", content: conversationId, sourceRefs: [], createdAt: now,
    });
    await repository.appendMessage(makeMessage("one"), "shared-key");
    await repository.appendMessage(makeMessage("two"), "shared-key");

    expect((await repository.findMessageByIdempotencyKey("demo-salon", "one", "shared-key"))?.id).toBe("message-one");
    expect((await repository.findMessageByIdempotencyKey("demo-salon", "two", "shared-key"))?.id).toBe("message-two");
    expect(await repository.findMessageByIdempotencyKey("other-company", "one", "shared-key")).toBeNull();
  });

  it("does not generate duplicate assistant work for concurrent message retries", async () => {
    const conversation = await conversationService.create({ assistantRole: "MARKETING", title: "Concurrent" }, ownerActor());
    const input = { content: "Tuesdays are quiet. Create a promotion.", idempotencyKey: "concurrent-message-key" };
    const results = await Promise.all([
      conversationService.send(conversation.id, input, ownerActor()),
      conversationService.send(conversation.id, input, ownerActor()),
    ]);
    expect(results.filter((result) => result.assistantMessage !== null)).toHaveLength(1);
    expect(await conversationService.listMessages(conversation.id, ownerActor())).toHaveLength(2);
  });
});
