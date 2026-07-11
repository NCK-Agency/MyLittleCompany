import { isMemoryEligible } from "@/domain/retrieval";
import type { ActorContext, HydratedMemory } from "@/domain/types";
import type { KnowledgeIndex } from "@/ports/knowledge-index";
import { getDemoState, saveDemoState } from "./demo-state";

function tokens(value: string): Set<string> {
  return new Set(value.toLowerCase().replace(/[^a-z0-9%]+/g, " ").split(/\s+/).filter(Boolean));
}

export class LocalKnowledgeIndex implements KnowledgeIndex {
  async upsert(memory: HydratedMemory): Promise<{ documentId: string }> {
    const state = getDemoState();
    state.indexedMemoryIds.add(memory.record.id);
    saveDemoState(state);
    return { documentId: `${memory.record.companyId}:${memory.record.id}:v${memory.version.version}` };
  }

  async retrieve(query: string, actor: ActorContext): Promise<HydratedMemory[]> {
    const state = getDemoState();
    const queryTokens = tokens(query);
    return state.memories
      .filter((memory) => state.indexedMemoryIds.has(memory.record.id))
      .filter((memory) => isMemoryEligible(memory, actor))
      .map((memory) => ({
        memory,
        score: [...tokens(`${memory.version.title} ${memory.version.statement} ${memory.version.rationale ?? ""}`)]
          .filter((token) => queryTokens.has(token)).length,
      }))
      .sort((left, right) => right.score - left.score)
      .map(({ memory }) => memory)
      .slice(0, 5);
  }
}
