import { describe, expect, it, vi } from "vitest";
import { RepositoryKnowledgeIndex } from "@/adapters/repository-knowledge-index";
import type { ActorContext, CanonicalMemoryDocument, HydratedMemory } from "@/domain/types";

function memory(overrides: Partial<HydratedMemory["record"]> = {}): HydratedMemory {
  return {
    record: {
      id: "memory-1",
      companyId: "company-a",
      type: "DECISION",
      status: "APPROVED",
      currentVersion: 1,
      title: "Pricing",
      scope: { level: "COMPANY" },
      appliesToRoles: ["EMPLOYEE"],
      sensitivity: "INTERNAL",
      tags: ["pricing"],
      effectiveFrom: "2026-07-11T00:00:00.000Z",
      createdAt: "2026-07-11T00:00:00.000Z",
      updatedAt: "2026-07-11T00:00:00.000Z",
      indexStatus: "READY",
      ...overrides,
    },
    version: {
      memoryId: overrides.id ?? "memory-1",
      companyId: overrides.companyId ?? "company-a",
      version: 1,
      title: "Promotional discount cap",
      scope: { level: "COMPANY" },
      statement: "Discounts cannot exceed 15%.",
      rationale: "Protect margins.",
      appliesToRoles: ["EMPLOYEE"],
      sensitivity: "INTERNAL",
      tags: ["pricing"],
      effectiveFrom: "2026-07-11T00:00:00.000Z",
      sourceRefs: [{ sourceId: "source", label: "Owner" }],
      approvedBy: "owner",
      approvedAt: "2026-07-11T00:00:00.000Z",
      createdAt: "2026-07-11T00:00:00.000Z",
    },
  };
}

const actor: ActorContext = {
  userId: "employee",
  companyId: "company-a",
  email: "employee@example.com",
  displayName: "Employee",
  roles: ["EMPLOYEE"],
  grants: [{ permission: "READ", scope: { level: "COMPANY" } }],
  demoMode: true,
};

const document: CanonicalMemoryDocument = {
  companyId: "company-a",
  memoryId: "memory-1",
  version: 1,
  key: "memories/company-a/memory-1/v1.md",
  uri: "memory://company-a/memory-1/v1",
  checksum: "checksum",
};

describe("RepositoryKnowledgeIndex", () => {
  it("marks an approved version with a deterministic search document id", async () => {
    const index = new RepositoryKnowledgeIndex({ listCurrent: vi.fn() } as never);
    await expect(index.upsert(memory({ indexStatus: "PENDING" }), document))
      .resolves.toEqual({ documentId: "company-a:memory-1:v1" });
  });

  it("searches only ready memories from the requested company", async () => {
    const listCurrent = vi.fn().mockResolvedValue([
      memory(),
      memory({ id: "pending", indexStatus: "PENDING" }),
      memory({ id: "other-company", companyId: "company-b" }),
    ]);
    const index = new RepositoryKnowledgeIndex({ listCurrent } as never);

    await expect(index.retrieve("15% discount", actor)).resolves.toEqual([{
      memoryId: "memory-1",
      version: 1,
      score: 3,
      metadata: {
        companyId: "company-a",
        status: "APPROVED",
        roleScopes: ["EMPLOYEE"],
        sensitivity: "INTERNAL",
      },
    }]);
    expect(listCurrent).toHaveBeenCalledWith("company-a");
  });

  it("returns no local context when the query has no meaningful overlap", async () => {
    const index = new RepositoryKnowledgeIndex({ listCurrent: vi.fn().mockResolvedValue([memory()]) } as never);

    await expect(index.retrieve("How should we request annual leave?", actor)).resolves.toEqual([]);
    await expect(index.retrieve("Can I give a customer 25% off?", actor)).resolves.toMatchObject([{
      memoryId: "memory-1",
      score: 2,
    }]);
  });
});
