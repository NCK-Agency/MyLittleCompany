import type { SourceReference } from "@/domain/types";
import type { SourceRepository } from "@/ports/source-repository";
import { getDemoState, saveDemoState } from "./demo-state";

export class LocalSourceRepository implements SourceRepository {
  async saveConversationSource(source: SourceReference): Promise<SourceReference> {
    const state = getDemoState();
    state.sources.push(source);
    saveDemoState(state);
    return source;
  }

  async get(sourceId: string): Promise<SourceReference | null> {
    return getDemoState().sources.find((source) => source.sourceId === sourceId) ?? null;
  }
}
