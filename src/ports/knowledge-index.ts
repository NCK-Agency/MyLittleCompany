import type { ActorContext, HydratedMemory } from "@/domain/types";

export interface KnowledgeIndex {
  upsert(memory: HydratedMemory): Promise<{ documentId: string }>;
  retrieve(query: string, actor: ActorContext): Promise<HydratedMemory[]>;
}
