import { describe, expect, it, vi } from "vitest";
import { S3SourceRepository } from "@/adapters/aws/s3-source-repository";
import type { HydratedMemory } from "@/domain/types";

const memory: HydratedMemory = {
  record: {
    id: "memory-1", companyId: "company-a", type: "DECISION", status: "APPROVED",
    currentVersion: 1, title: "Pricing", scope: { level: "COMPANY" }, appliesToRoles: ["EMPLOYEE"], sensitivity: "INTERNAL",
    tags: [], effectiveFrom: "2026-07-11T00:00:00.000Z", createdAt: "2026-07-11T00:00:00.000Z",
    updatedAt: "2026-07-11T00:00:00.000Z", indexStatus: "PENDING",
  },
  version: {
    memoryId: "memory-1", companyId: "company-a", version: 1, title: "Pricing", scope: { level: "COMPANY" },
    statement: "Discounts cannot exceed 15%.", rationale: null, appliesToRoles: ["EMPLOYEE"],
    sensitivity: "INTERNAL", tags: [], effectiveFrom: "2026-07-11T00:00:00.000Z",
    sourceRefs: [{ sourceId: "source", label: "Owner" }], approvedBy: "owner",
    approvedAt: "2026-07-11T00:00:00.000Z", createdAt: "2026-07-11T00:00:00.000Z",
  },
};

describe("S3SourceRepository", () => {
  it("uses a deterministic company-prefixed key, document, checksum, and encryption", async () => {
    const send = vi.fn().mockResolvedValue({});
    const repository = new S3SourceRepository({ send } as never, "bucket");
    const first = await repository.saveMemoryDocument(memory);
    const second = await repository.saveMemoryDocument(memory);
    expect(first).toEqual(second);
    expect(first.key).toBe("memories/company-a/memory-1/v1.md");
    const input = send.mock.calls[0]?.[0]?.input;
    expect(input).toMatchObject({
      Bucket: "bucket", Key: first.key, ServerSideEncryption: "AES256",
      ContentType: "text/markdown; charset=utf-8", ChecksumSHA256: expect.any(String),
    });
  });

  it("stores imported raw content privately with an explicit retention tag", async () => {
    const send = vi.fn().mockResolvedValue({});
    const repository = new S3SourceRepository({ send } as never, "bucket");
    const source = await repository.saveImportedSource({
      id: "source-import", companyId: "company-a", kind: "MANUAL", provider: "PASTE",
      title: "Owner notes", checksum: "a".repeat(64), contentStatus: "ACTIVE",
      retention: "UNAPPROVED_30_DAYS", deleteAfter: "2026-08-10T00:00:00.000Z",
      createdBy: "owner", createdAt: "2026-07-11T00:00:00.000Z", updatedAt: "2026-07-11T00:00:00.000Z",
    }, "Private source text");

    expect(source.storageKey).toBe("imports/company-a/source-import.json");
    expect(send.mock.calls[0]?.[0]?.input).toMatchObject({
      Bucket: "bucket", Key: "imports/company-a/source-import.json",
      ServerSideEncryption: "AES256", Tagging: "retention=unapproved-30-days",
    });
  });
});
