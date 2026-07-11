import { appError } from "@/domain/errors";
import type { ImportedSource } from "@/domain/types";
import type { SourceImporter } from "@/ports/source-importer";
import type { SourceRepository } from "@/ports/source-repository";

export class S3SourceImporter implements SourceImporter {
  constructor(private readonly sources: SourceRepository) {}

  async importSource(source: ImportedSource, content: string): Promise<ImportedSource> {
    if (!content || content.length > 40_000 || content.includes("\0")) throw appError("VALIDATION_ERROR");
    return this.sources.saveImportedSource(source, content);
  }
}
