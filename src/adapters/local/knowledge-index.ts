import type {
  ActorContext,
  CanonicalMemoryDocument,
  HydratedMemory,
  KnowledgeIndexHit,
} from "@/domain/types";
import type { KnowledgeIndex } from "@/ports/knowledge-index";
import { getDemoState, saveDemoState } from "./demo-state";

function tokens(value: string): Set<string> {
  return new Set(value.toLowerCase().replace(/[^a-z0-9%]+/g, " ").split(/\s+/).filter(Boolean));
}

export class LocalKnowledgeIndex implements KnowledgeIndex {
  async upsert(
    memory: HydratedMemory,
    document: CanonicalMemoryDocument,
  ): Promise<{ documentId: string }> {
    void document;
    const state = getDemoState();
    state.indexedMemoryIds.add(memory.record.id);
    saveDemoState(state);
    return { documentId: `${memory.record.companyId}:${memory.record.id}:v${memory.version.version}` };
  }

  async retrieve(query: string, actor: ActorContext): Promise<KnowledgeIndexHit[]> {
    const state = getDemoState();
    const queryTokens = tokens(query);
    return state.memories
      .filter((memory) => state.indexedMemoryIds.has(memory.record.id))
      .filter((memory) => memory.record.companyId === actor.companyId)
      .map((memory) => ({
        memory,
        score: [...tokens(`${memory.version.title} ${memory.version.statement} ${memory.version.rationale ?? ""}`)]
          .filter((token) => queryTokens.has(token)).length,
      }))
      .sort((left, right) => right.score - left.score)
      .map(({ memory, score }) => ({
        memoryId: memory.record.id,
        version: memory.version.version,
        score,
        metadata: {
          companyId: memory.record.companyId,
          status: memory.record.status,
          roleScopes: memory.record.appliesToRoles,
          sensitivity: memory.record.sensitivity,
        },
      }))
      .slice(0, 5);
  }
}
