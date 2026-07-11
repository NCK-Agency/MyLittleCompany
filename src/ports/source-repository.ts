import type {
  CanonicalMemoryDocument,
  HydratedMemory,
  ImportedSource,
  SourceReference,
  StoredImportedSource,
} from "@/domain/types";

export interface SourceRepository {
  saveConversationSource(companyId: string, source: SourceReference): Promise<SourceReference>;
  saveMemoryDocument(memory: HydratedMemory): Promise<CanonicalMemoryDocument>;
  get(sourceId: string, companyId: string): Promise<SourceReference | null>;
  saveImportedSource(source: ImportedSource, content: string): Promise<ImportedSource>;
  getImportedSource(sourceId: string, companyId: string): Promise<StoredImportedSource | null>;
  setImportedSourceExpiry(sourceId: string, companyId: string, deleteAfter: string, retention: "ZERO_CANDIDATE_24_HOURS" | "ALL_IGNORED_7_DAYS"): Promise<ImportedSource>;
  retainImportedSource(sourceId: string, companyId: string): Promise<ImportedSource>;
  deleteImportedContent(sourceId: string, companyId: string, actorId: string): Promise<ImportedSource>;
}
