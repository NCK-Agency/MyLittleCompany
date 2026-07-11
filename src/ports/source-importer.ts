import type { ImportedSource } from "@/domain/types";

export interface SourceImporter {
  importSource(source: ImportedSource, content: string): Promise<ImportedSource>;
}
