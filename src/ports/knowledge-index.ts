import type {
  ActorContext,
  CanonicalMemoryDocument,
  CompanyRole,
  HydratedMemory,
  KnowledgeIndexHit,
} from "@/domain/types";

export interface KnowledgeIndex {
  upsert(
    memory: HydratedMemory,
    document: CanonicalMemoryDocument,
  ): Promise<{ documentId: string }>;
  retrieve(query: string, actor: ActorContext, requestedRoles?: CompanyRole[]): Promise<KnowledgeIndexHit[]>;
}
