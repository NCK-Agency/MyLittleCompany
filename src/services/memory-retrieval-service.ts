import { isMemoryEligible } from "@/domain/retrieval";
import type { ActorContext, CompanyRole, HydratedMemory, KnowledgeScope } from "@/domain/types";
import type { KnowledgeIndex } from "@/ports/knowledge-index";
import type { MemoryRepository } from "@/ports/memory-repository";

export class MemoryRetrievalService {
  constructor(
    private readonly index: KnowledgeIndex,
    private readonly memories: MemoryRepository,
  ) {}

  async retrieve(
    query: string,
    actor: ActorContext,
    requestedRoles?: CompanyRole[],
    requestedScope?: KnowledgeScope,
  ): Promise<HydratedMemory[]> {
    const hits = await this.index.retrieve(query, actor, requestedRoles);
    const seen = new Set<string>();
    const uniqueHits = hits.filter((hit) => {
      const key = `${hit.memoryId}:v${hit.version}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    const hydrated = await Promise.all(uniqueHits.map(async (hit) => {
      if (hit.metadata.companyId !== actor.companyId || hit.metadata.status !== "APPROVED"
        || !Array.isArray(hit.metadata.roleScopes) || hit.metadata.roleScopes.length === 0
        || typeof hit.metadata.sensitivity !== "string" || hit.metadata.sensitivity.length === 0) return null;
      const memory = await this.memories.getCurrent(hit.memoryId, actor.companyId);
      if (!memory || memory.version.version !== hit.version) return null;
      if (requestedScope?.level === "COMPANY" && memory.record.scope.level !== "COMPANY") return null;
      if (requestedScope?.level === "DEPARTMENT" && memory.record.scope.level === "DEPARTMENT"
        && memory.record.scope.organizationalUnitId !== requestedScope.organizationalUnitId) return null;
      return isMemoryEligible(memory, actor, requestedRoles) ? memory : null;
    }));
    return hydrated.filter((memory): memory is HydratedMemory => memory !== null);
  }
}
