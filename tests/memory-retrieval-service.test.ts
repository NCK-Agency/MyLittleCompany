import { describe, expect, it } from "vitest";
import type { ActorContext, HydratedMemory, KnowledgeIndexHit, MemoryCandidate, MemoryRecord } from "@/domain/types";
import type { KnowledgeIndex } from "@/ports/knowledge-index";
import type { MemoryRepository } from "@/ports/memory-repository";
import { MemoryRetrievalService } from "@/services/memory-retrieval-service";

const actor: ActorContext = {
  userId: "employee", companyId: "company-a", email: "employee@example.com",
  displayName: "Employee", roles: ["EMPLOYEE"],
  grants: [{ permission: "READ", scope: { level: "COMPANY" } }], demoMode: true,
};

function memory(overrides: Partial<MemoryRecord> = {}): HydratedMemory {
  const now = "2026-07-11T00:00:00.000Z";
  const record: MemoryRecord = {
    id: "memory-1", companyId: "company-a", type: "DECISION", status: "APPROVED",
    currentVersion: 1, title: "Pricing", appliesToRoles: ["EMPLOYEE"], sensitivity: "INTERNAL",
    tags: [], effectiveFrom: now, createdAt: now, updatedAt: now, indexStatus: "READY", ...overrides,
    scope: overrides.scope ?? { level: "COMPANY" },
  };
  return { record, version: {
    memoryId: record.id, companyId: record.companyId, version: 1, title: record.title, scope: record.scope,
    statement: "Maximum discount is 15%.", rationale: null, appliesToRoles: record.appliesToRoles,
    sensitivity: record.sensitivity, tags: [], effectiveFrom: now, sourceRefs: [{ sourceId: "source", label: "Owner" }],
    approvedBy: "owner", approvedAt: now, createdAt: now,
  } };
}

class HitIndex implements KnowledgeIndex {
  constructor(private readonly hits: KnowledgeIndexHit[]) {}
  async upsert(): Promise<{ documentId: string }> { return { documentId: "unused" }; }
  async retrieve(): Promise<KnowledgeIndexHit[]> { return this.hits; }
}

class MemoryStore implements MemoryRepository {
  constructor(private readonly value: HydratedMemory | null) {}
  async getCurrent(): Promise<HydratedMemory | null> { return this.value; }
  async listVersions() { return this.value ? [this.value.version] : []; }
  async createVersion() { if (!this.value) throw new Error("NOT_FOUND"); return this.value; }
  async createCandidate(candidate: MemoryCandidate): Promise<MemoryCandidate> { return candidate; }
  async listCandidates(): Promise<MemoryCandidate[]> { return []; }
  async getCandidate(): Promise<MemoryCandidate | null> { return null; }
  async updateCandidate(candidate: MemoryCandidate): Promise<MemoryCandidate> { return candidate; }
  async listCurrent(): Promise<HydratedMemory[]> { return this.value ? [this.value] : []; }
  async approveCandidate(): Promise<never> { throw new Error("unused"); }
  async approveCandidateAsVersion(): Promise<never> { throw new Error("unused"); }
  async createApprovedMemory(): Promise<never> { throw new Error("unused"); }
  async updateRecord(): Promise<void> {}
  async appendAudit(): Promise<void> {}
}

describe("MemoryRetrievalService", () => {
  const metadata = {
    companyId: "company-a",
    status: "APPROVED",
    roleScopes: ["EMPLOYEE"],
    sensitivity: "INTERNAL",
  };
  const hit = (overrides: Partial<KnowledgeIndexHit> = {}): KnowledgeIndexHit => ({
    memoryId: "memory-1", version: 1, metadata, ...overrides,
  });

  it("hydrates a valid hit from structured storage", async () => {
    expect(await new MemoryRetrievalService(new HitIndex([hit()]), new MemoryStore(memory())).retrieve("discount", actor)).toHaveLength(1);
  });

  it("lets an owner retrieve applicable knowledge without requiring OWNER as a business target", async () => {
    const owner: ActorContext = { ...actor, roles: ["OWNER"], grants: [] };
    const stored = memory({ appliesToRoles: ["MARKETING"] });
    expect(await new MemoryRetrievalService(new HitIndex([hit()]), new MemoryStore(stored)).retrieve("discount", owner)).toHaveLength(1);
  });

  it("does not let a selected assistant role expand a member's business-role access", async () => {
    const stored = memory({ appliesToRoles: ["MARKETING"] });
    const service = new MemoryRetrievalService(new HitIndex([hit()]), new MemoryStore(stored));

    expect(await service.retrieve("campaign", actor, ["MARKETING"])).toEqual([]);
    expect(await service.retrieve("campaign", { ...actor, roles: ["OWNER"], grants: [] }, ["MARKETING"]))
      .toHaveLength(1);
  });

  it("deduplicates multiple chunks from the same memory version", async () => {
    expect(await new MemoryRetrievalService(new HitIndex([hit(), hit({ score: 0.5 })]), new MemoryStore(memory())).retrieve("discount", actor)).toHaveLength(1);
  });

  it("keeps company conversations out of department memory and inherits company memory into a department", async () => {
    const department = { level: "DEPARTMENT" as const, organizationalUnitId: "operations" };
    const service = new MemoryRetrievalService(new HitIndex([hit()]), new MemoryStore(memory({ scope: department })));
    expect(await service.retrieve("discount", actor, ["EMPLOYEE"], { level: "COMPANY" })).toEqual([]);
    expect(await service.retrieve("discount", actor, ["EMPLOYEE"], department)).toHaveLength(1);

    const companyService = new MemoryRetrievalService(new HitIndex([hit()]), new MemoryStore(memory()));
    expect(await companyService.retrieve("discount", actor, ["EMPLOYEE"], department)).toHaveLength(1);
  });

  it.each([
    ["missing company metadata", hit({ metadata: { ...metadata, companyId: undefined } as never }), memory()],
    ["wrong-company metadata", hit({ metadata: { ...metadata, companyId: "company-b" } }), memory()],
    ["missing approval metadata", hit({ metadata: { ...metadata, status: undefined } as never }), memory()],
    ["missing role metadata", hit({ metadata: { ...metadata, roleScopes: undefined } as never }), memory()],
    ["missing sensitivity metadata", hit({ metadata: { ...metadata, sensitivity: undefined } as never }), memory()],
    ["stale hit version", hit({ version: 2 }), memory()],
    ["proposed index state", hit(), memory({ indexStatus: "PENDING" })],
    ["rejected role", hit(), memory({ appliesToRoles: ["MARKETING"] })],
    ["confidential record", hit(), memory({ sensitivity: "CONFIDENTIAL" })],
    ["superseded record", hit(), memory({ status: "SUPERSEDED" })],
  ])("rejects %s", async (_name, poisonedHit, stored) => {
    const result = await new MemoryRetrievalService(new HitIndex([poisonedHit]), new MemoryStore(stored)).retrieve("discount", actor);
    expect(result).toEqual([]);
  });
});
