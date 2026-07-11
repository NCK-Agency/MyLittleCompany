import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createHash } from "node:crypto";
import { renderMemoryDocument } from "@/domain/render-memory";
import { sourceReferenceSchema } from "@/domain/schemas";
import { importedSourceSchema } from "@/domain/schemas";
import type {
  CanonicalMemoryDocument,
  HydratedMemory,
  ImportedSource,
  SourceReference,
  StoredImportedSource,
} from "@/domain/types";
import type { SourceRepository } from "@/ports/source-repository";

function checksum(body: string): { hex: string; base64: string } {
  const digest = createHash("sha256").update(body).digest();
  return { hex: digest.toString("hex"), base64: digest.toString("base64") };
}

export class S3SourceRepository implements SourceRepository {
  constructor(
    private readonly client: S3Client,
    private readonly bucket: string,
  ) {}

  async saveConversationSource(companyId: string, source: SourceReference): Promise<SourceReference> {
    const body = JSON.stringify(source);
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: `sources/${companyId}/${source.sourceId}.json`,
      Body: body,
      ContentType: "application/json",
      ServerSideEncryption: "AES256",
      ChecksumSHA256: checksum(body).base64,
    }));
    return source;
  }

  async saveMemoryDocument(memory: HydratedMemory): Promise<CanonicalMemoryDocument> {
    const body = renderMemoryDocument(memory);
    const digest = checksum(body);
    const key = `memories/${memory.record.companyId}/${memory.record.id}/v${memory.version.version}.md`;
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: body,
      ContentType: "text/markdown; charset=utf-8",
      ServerSideEncryption: "AES256",
      ChecksumSHA256: digest.base64,
      Metadata: {
        companyid: memory.record.companyId,
        memoryid: memory.record.id,
        version: String(memory.version.version),
      },
    }));
    return {
      companyId: memory.record.companyId,
      memoryId: memory.record.id,
      version: memory.version.version,
      key,
      uri: `s3://${this.bucket}/${key}`,
      checksum: digest.hex,
    };
  }

  async get(sourceId: string, companyId: string): Promise<SourceReference | null> {
    try {
      const response = await this.client.send(new GetObjectCommand({
        Bucket: this.bucket,
        Key: `sources/${companyId}/${sourceId}.json`,
      }));
      const body = await response.Body?.transformToString();
      return body ? sourceReferenceSchema.parse(JSON.parse(body) as unknown) : null;
    } catch (error) {
      if (error instanceof Error && error.name === "NoSuchKey") return null;
      throw error;
    }
  }

  async saveImportedSource(source: ImportedSource, content: string): Promise<ImportedSource> {
    const parsed = importedSourceSchema.parse(source);
    const key = `imports/${source.companyId}/${source.id}.json`;
    const body = JSON.stringify({ source: { ...parsed, storageKey: key }, content });
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: body,
      ContentType: "application/json",
      ServerSideEncryption: "AES256",
      ChecksumSHA256: checksum(body).base64,
      Metadata: { companyid: source.companyId, sourceid: source.id, provider: source.provider },
      Tagging: `retention=${source.retention.toLowerCase().replaceAll("_", "-")}`,
    }));
    return importedSourceSchema.parse({ ...parsed, storageKey: key });
  }

  async getImportedSource(sourceId: string, companyId: string): Promise<StoredImportedSource | null> {
    try {
      const response = await this.client.send(new GetObjectCommand({
        Bucket: this.bucket,
        Key: `imports/${companyId}/${sourceId}.json`,
      }));
      const body = await response.Body?.transformToString();
      if (!body) return null;
      const value = JSON.parse(body) as { source?: unknown; content?: unknown };
      return {
        source: importedSourceSchema.parse(value.source),
        content: typeof value.content === "string" ? value.content : null,
      };
    } catch (error) {
      if (error instanceof Error && error.name === "NoSuchKey") return null;
      throw error;
    }
  }

  async retainImportedSource(sourceId: string, companyId: string): Promise<ImportedSource> {
    const stored = await this.getImportedSource(sourceId, companyId);
    if (!stored?.content) throw new Error("NOT_FOUND");
    return this.saveImportedSource(importedSourceSchema.parse({
      ...stored.source,
      retention: "APPROVED",
      deleteAfter: undefined,
      updatedAt: new Date().toISOString(),
    }), stored.content);
  }

  async setImportedSourceExpiry(sourceId: string, companyId: string, deleteAfter: string, retention: "ZERO_CANDIDATE_24_HOURS" | "ALL_IGNORED_7_DAYS"): Promise<ImportedSource> {
    const stored = await this.getImportedSource(sourceId, companyId);
    if (!stored?.content) throw new Error("NOT_FOUND");
    return this.saveImportedSource(importedSourceSchema.parse({
      ...stored.source,
      deleteAfter,
      retention,
      updatedAt: new Date().toISOString(),
    }), stored.content);
  }

  async deleteImportedContent(sourceId: string, companyId: string, actorId: string): Promise<ImportedSource> {
    void actorId;
    const stored = await this.getImportedSource(sourceId, companyId);
    if (!stored) throw new Error("NOT_FOUND");
    const source = importedSourceSchema.parse({
      ...stored.source,
      contentStatus: "DELETED",
      retention: "DELETED",
      storageKey: undefined,
      updatedAt: new Date().toISOString(),
    });
    const body = JSON.stringify({ source, content: null });
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: `imports/${companyId}/${sourceId}.json`,
      Body: body,
      ContentType: "application/json",
      ServerSideEncryption: "AES256",
      ChecksumSHA256: checksum(body).base64,
      Metadata: { companyid: companyId, sourceid: sourceId, deleted: "true" },
    }));
    return source;
  }
}
