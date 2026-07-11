import { describe, expect, it, vi } from "vitest";
import { BedrockKnowledgeIndex } from "@/adapters/aws/bedrock-knowledge-index";
import type { ActorContext, CanonicalMemoryDocument, HydratedMemory } from "@/domain/types";

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
const document: CanonicalMemoryDocument = {
  companyId: "company-a", memoryId: "memory-1", version: 1,
  key: "memories/company-a/memory-1/v1.md", uri: "s3://bucket/memories/company-a/memory-1/v1.md",
  checksum: "checksum",
};
const actor: ActorContext = {
  userId: "employee", companyId: "company-a", email: "employee@example.com",
  displayName: "Employee", roles: ["EMPLOYEE"],
  grants: [{ permission: "READ", scope: { level: "COMPANY" } }], demoMode: true,
};

describe("BedrockKnowledgeIndex", () => {
  it("waits for INDEXED and retrieves only identifier metadata", async () => {
    const agentSend = vi.fn()
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ documentDetails: [{ status: "INDEXED" }] });
    const runtimeSend = vi.fn().mockResolvedValue({ retrievalResults: [{
      score: 0.9,
      content: { text: "untrusted chunk" },
      metadata: {
        companyId: "company-a", memoryId: "memory-1", version: 1,
        status: "APPROVED", roleScopes: ["EMPLOYEE"], sensitivity: "INTERNAL",
      },
    }] });
    const index = new BedrockKnowledgeIndex(
      { send: agentSend } as never,
      { send: runtimeSend } as never,
      "kb-id",
      "source-id",
    );
    await expect(index.upsert(memory, document)).resolves.toEqual({ documentId: "company-a:memory-1:v1" });
    await expect(index.retrieve("discount", actor)).resolves.toEqual([{
      memoryId: "memory-1", version: 1, score: 0.9,
      metadata: {
        companyId: "company-a", status: "APPROVED",
        roleScopes: ["EMPLOYEE"], sensitivity: "INTERNAL",
      },
    }]);
  });

  it("fails safely when direct ingestion reports FAILED", async () => {
    const agentSend = vi.fn()
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ documentDetails: [{ status: "FAILED", statusReason: "private" }] });
    const index = new BedrockKnowledgeIndex(
      { send: agentSend } as never,
      { send: vi.fn() } as never,
      "kb-id",
      "source-id",
    );
    await expect(index.upsert(memory, document)).rejects.toMatchObject({ code: "INDEX_FAILED", retryable: true });
  });

  it("drops results with missing, malformed, or cross-company metadata", async () => {
    const runtimeSend = vi.fn().mockResolvedValue({ retrievalResults: [
      { metadata: { memoryId: "memory-1", version: 1, status: "APPROVED", roleScopes: ["EMPLOYEE"], sensitivity: "INTERNAL" } },
      { metadata: { companyId: "company-b", memoryId: "memory-1", version: 1, status: "APPROVED", roleScopes: ["EMPLOYEE"], sensitivity: "INTERNAL" } },
      { metadata: { companyId: "company-a", memoryId: "memory-1", version: 0, status: "APPROVED", roleScopes: ["EMPLOYEE"], sensitivity: "INTERNAL" } },
      { metadata: { companyId: "company-a", memoryId: "memory-1", version: 1, status: "PROPOSED", roleScopes: ["EMPLOYEE"], sensitivity: "INTERNAL" } },
      { metadata: { companyId: "company-a", memoryId: "memory-1", version: 1, status: "APPROVED", roleScopes: [], sensitivity: "INTERNAL" } },
    ] });
    const index = new BedrockKnowledgeIndex(
      { send: vi.fn() } as never,
      { send: runtimeSend } as never,
      "kb-id",
      "source-id",
    );

    await expect(index.retrieve("discount", actor)).resolves.toEqual([]);
  });

  it("does not require OWNER to appear in business-role metadata", async () => {
    const runtimeSend = vi.fn().mockResolvedValue({ retrievalResults: [{
      metadata: {
        companyId: "company-a", memoryId: "memory-1", version: 1,
        status: "APPROVED", roleScopes: ["EMPLOYEE"], sensitivity: "INTERNAL",
      },
    }] });
    const index = new BedrockKnowledgeIndex(
      { send: vi.fn() } as never,
      { send: runtimeSend } as never,
      "kb-id",
      "source-id",
    );

    await expect(index.retrieve("discount", { ...actor, roles: ["OWNER"], grants: [] })).resolves.toHaveLength(1);
    const retrieve = runtimeSend.mock.calls[0]?.[0];
    const filters = retrieve.input.retrievalConfiguration.vectorSearchConfiguration.filter.andAll;
    expect(filters).toHaveLength(2);
  });
});
