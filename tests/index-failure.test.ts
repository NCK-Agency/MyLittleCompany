import { beforeEach, describe, expect, it } from "vitest";
import { LocalKnowledgeIndex } from "@/adapters/local/knowledge-index";
import { LocalCompanyRepository } from "@/adapters/local/company-repository";
import { LocalConversationRepository } from "@/adapters/local/conversation-repository";
import { LocalMemoryRepository } from "@/adapters/local/memory-repository";
import { LocalSourceRepository } from "@/adapters/local/source-repository";
import { resetDemoState } from "@/adapters/local/demo-state";
import type { ActorContext, KnowledgeIndexHit } from "@/domain/types";
import type { KnowledgeIndex } from "@/ports/knowledge-index";
import { ownerActor } from "@/server/actors";
import { connectedSuggestionService, conversationService } from "@/server/container";
import { MemoryService } from "@/services/memory-service";

class FailingIndex implements KnowledgeIndex {
  async upsert(): Promise<{ documentId: string }> { throw new Error("index unavailable"); }
  async retrieve(query: string, actor: ActorContext): Promise<KnowledgeIndexHit[]> {
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
    const sources = new LocalSourceRepository();
    const conversations = new LocalConversationRepository();
    const companies = new LocalCompanyRepository();
    const failing = new MemoryService(repository, new FailingIndex(), sources, conversations, companies, connectedSuggestionService);
    const approved = await failing.approveCandidate(result.suggestedKnowledge[0].id, 1, ownerActor());
    expect(approved.record.status).toBe("APPROVED");
    expect(approved.record.indexStatus).toBe("FAILED");

    const recovered = await new MemoryService(repository, new LocalKnowledgeIndex(), sources, conversations, companies, connectedSuggestionService).retryIndex(approved.record.id, ownerActor());
    expect(recovered.record.indexStatus).toBe("READY");
    expect(recovered.record.currentVersion).toBe(1);
  });
});
