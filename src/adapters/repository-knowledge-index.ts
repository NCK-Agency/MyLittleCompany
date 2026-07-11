import type {
  ActorContext,
  CanonicalMemoryDocument,
  HydratedMemory,
  KnowledgeIndexHit,
} from "@/domain/types";
import type { KnowledgeIndex } from "@/ports/knowledge-index";
import type { MemoryRepository } from "@/ports/memory-repository";

const stopWords = new Set([
  "a", "an", "and", "are", "can", "do", "does", "for", "how", "i", "is", "it", "of", "our", "the", "to", "we", "what", "when", "with",
]);

function tokens(value: string): Set<string> {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9%]+/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1 && !stopWords.has(token));
  return new Set(normalized.flatMap((token) => {
    if (/^\d+%$/.test(token)) return [token, "percentage"];
    if (token === "off" || token === "discounts") return ["discount"];
    return [token];
  }));
}

function relevance(memory: HydratedMemory, queryTokens: Set<string>): number {
  const memoryTokens = tokens([
    memory.version.title,
    memory.version.statement,
    memory.version.rationale ?? "",
    memory.version.tags.join(" "),
  ].join(" "));
  return [...memoryTokens].filter((token) => queryTokens.has(token)).length;
}

export class RepositoryKnowledgeIndex implements KnowledgeIndex {
  constructor(private readonly memories: MemoryRepository) {}

  async upsert(
    memory: HydratedMemory,
    document: CanonicalMemoryDocument,
  ): Promise<{ documentId: string }> {
    void document;
    return {
      documentId: `${memory.record.companyId}:${memory.record.id}:v${memory.version.version}`,
    };
  }

  async retrieve(query: string, actor: ActorContext): Promise<KnowledgeIndexHit[]> {
    const queryTokens = tokens(query);
    const memories = await this.memories.listCurrent(actor.companyId);
    return memories
      .filter((memory) => memory.record.companyId === actor.companyId)
      .filter((memory) => memory.record.indexStatus === "READY")
      .map((memory) => ({ memory, score: relevance(memory, queryTokens) }))
      .filter(({ score }) => score > 0)
      .sort((left, right) => right.score - left.score
        || right.memory.record.updatedAt.localeCompare(left.memory.record.updatedAt))
      .slice(0, 5)
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
      }));
  }
}
