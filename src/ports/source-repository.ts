import type { SourceReference } from "@/domain/types";

export interface SourceRepository {
  saveConversationSource(source: SourceReference): Promise<SourceReference>;
  get(sourceId: string): Promise<SourceReference | null>;
}
