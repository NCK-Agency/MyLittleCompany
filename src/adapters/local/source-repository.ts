import { createHash } from "node:crypto";
import { renderMemoryDocument } from "@/domain/render-memory";
import { appError } from "@/domain/errors";
import { importedSourceSchema } from "@/domain/schemas";
import type {
  CanonicalMemoryDocument,
  HydratedMemory,
  ImportedSource,
  SourceReference,
  StoredImportedSource,
} from "@/domain/types";
import type { SourceRepository } from "@/ports/source-repository";
import { getDemoState, saveDemoState } from "./demo-state";

export class LocalSourceRepository implements SourceRepository {
  async saveConversationSource(companyId: string, source: SourceReference): Promise<SourceReference> {
    void companyId;
    const state = getDemoState();
    const existingIndex = state.sources.findIndex((item) => item.sourceId === source.sourceId);
    if (existingIndex >= 0) state.sources[existingIndex] = source;
    else state.sources.push(source);
    saveDemoState(state);
    return source;
  }

  async saveMemoryDocument(memory: HydratedMemory): Promise<CanonicalMemoryDocument> {
    const body = renderMemoryDocument(memory);
    const key = `memories/${memory.record.companyId}/${memory.record.id}/v${memory.version.version}.md`;
    return {
      companyId: memory.record.companyId,
      memoryId: memory.record.id,
      version: memory.version.version,
      key,
      uri: `local://${key}`,
      checksum: createHash("sha256").update(body).digest("hex"),
    };
  }

  async get(sourceId: string, companyId: string): Promise<SourceReference | null> {
    void companyId;
    return getDemoState().sources.find((source) => source.sourceId === sourceId) ?? null;
  }

  async saveImportedSource(source: ImportedSource, content: string): Promise<ImportedSource> {
    const state = getDemoState();
    const parsed = importedSourceSchema.parse(source);
    state.importedSources.push({ source: parsed, content });
    state.sources.push({ sourceId: parsed.id, label: parsed.title });
    saveDemoState(state);
    return parsed;
  }

  async getImportedSource(sourceId: string, companyId: string): Promise<StoredImportedSource | null> {
    return getDemoState().importedSources.find((item) =>
      item.source.id === sourceId && item.source.companyId === companyId,
    ) ?? null;
  }

  async retainImportedSource(sourceId: string, companyId: string): Promise<ImportedSource> {
    const state = getDemoState();
    const item = state.importedSources.find((value) => value.source.id === sourceId && value.source.companyId === companyId);
    if (!item) throw appError("NOT_FOUND");
    item.source = importedSourceSchema.parse({ ...item.source, retention: "APPROVED", deleteAfter: undefined, updatedAt: new Date().toISOString() });
    saveDemoState(state);
    return item.source;
  }

  async setImportedSourceExpiry(sourceId: string, companyId: string, deleteAfter: string, retention: "ZERO_CANDIDATE_24_HOURS" | "ALL_IGNORED_7_DAYS"): Promise<ImportedSource> {
    const state = getDemoState();
    const item = state.importedSources.find((value) => value.source.id === sourceId && value.source.companyId === companyId);
    if (!item) throw appError("NOT_FOUND");
    item.source = importedSourceSchema.parse({ ...item.source, deleteAfter, retention, updatedAt: new Date().toISOString() });
    saveDemoState(state);
    return item.source;
  }

  async deleteImportedContent(sourceId: string, companyId: string, actorId: string): Promise<ImportedSource> {
    void actorId;
    const state = getDemoState();
    const item = state.importedSources.find((value) =>
      value.source.id === sourceId && value.source.companyId === companyId,
    );
    if (!item) throw appError("NOT_FOUND");
    item.content = null;
    item.source = importedSourceSchema.parse({
      ...item.source,
      contentStatus: "DELETED",
      retention: "DELETED",
      storageKey: undefined,
      updatedAt: new Date().toISOString(),
    });
    saveDemoState(state);
    return item.source;
  }
}
