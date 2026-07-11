import { beforeEach, describe, expect, it } from "vitest";
import { LocalKnowledgeIndex } from "@/adapters/local/knowledge-index";
import { LocalMemoryRepository } from "@/adapters/local/memory-repository";
import { resetDemoState } from "@/adapters/local/demo-state";
import type { ActorContext, HydratedMemory } from "@/domain/types";
import type { KnowledgeIndex } from "@/ports/knowledge-index";
import { ownerActor } from "@/server/actors";
import { conversationService } from "@/server/container";
import { MemoryService } from "@/services/memory-service";

class FailingIndex implements KnowledgeIndex {
  async upsert(): Promise<{ documentId: string }> { throw new Error("index unavailable"); }
  async retrieve(query: string, actor: ActorContext): Promise<HydratedMemory[]> {
    void query;
    void actor;
    return [];
  }
}

describe("index failure handling", () => {
  beforeEach(() => resetDemoState());

  it("keeps approval truthful and supports an idempotent retry", async () => {
    const conversation = await conversationService.create({ assistantRole: "MARKETING", title: "Tuesday" }, ownerActor());
    const result = await conversationService.send(conversation.id, {
      content: "We never discount more than 15%. We prefer offering a free add-on because we want to maintain a premium image.",
      idempotencyKey: "index-failure-rule",
    }, ownerActor());
    const repository = new LocalMemoryRepository();
    const failing = new MemoryService(repository, new FailingIndex());
    const approved = await failing.approveCandidate(result.suggestedKnowledge[0].id, 1, ownerActor());
    expect(approved.record.status).toBe("APPROVED");
    expect(approved.record.indexStatus).toBe("FAILED");

    const recovered = await new MemoryService(repository, new LocalKnowledgeIndex()).retryIndex(approved.record.id, ownerActor());
    expect(recovered.record.indexStatus).toBe("READY");
    expect(recovered.record.currentVersion).toBe(1);
  });
});
