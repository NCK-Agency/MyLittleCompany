import { describe, expect, it } from "vitest";
import { canAccess } from "@/domain/authorization";
import { isMemoryEligible } from "@/domain/retrieval";
import type { ActorContext, HydratedMemory } from "@/domain/types";

function actor(overrides: Partial<ActorContext> = {}): ActorContext {
  return {
    userId: "user-1",
    companyId: "company-1",
    email: "person@example.com",
    displayName: "Person",
    roles: ["MARKETING"],
    grants: [],
    demoMode: true,
    ...overrides,
  };
}

const company = { level: "COMPANY" as const };
const marketing = { level: "DEPARTMENT" as const, organizationalUnitId: "marketing" };
const operations = { level: "DEPARTMENT" as const, organizationalUnitId: "operations" };

function memory(scope = marketing, sensitivity: "INTERNAL" | "CONFIDENTIAL" = "INTERNAL"): HydratedMemory {
  const now = "2026-07-11T00:00:00.000Z";
  return {
    record: {
      id: "memory-1", companyId: "company-1", type: "POLICY", status: "APPROVED",
      currentVersion: 1, title: "Rule", scope, appliesToRoles: ["MARKETING"], sensitivity,
      tags: [], effectiveFrom: now, createdAt: now, updatedAt: now, indexStatus: "READY",
    },
    version: {
      memoryId: "memory-1", companyId: "company-1", version: 1, title: "Rule", scope,
      statement: "A rule", rationale: null, appliesToRoles: ["MARKETING"], sensitivity,
      tags: [], effectiveFrom: now, sourceRefs: [{ sourceId: "source-1", label: "Owner" }],
      approvedBy: "owner", approvedAt: now, createdAt: now,
    },
  };
}

describe("scoped knowledge authorization", () => {
  it("gives owners unrestricted access", () => {
    const owner = actor({ roles: ["OWNER"] });
    expect(canAccess(owner, "APPROVE", operations)).toBe(true);
    expect(canAccess(owner, "SUGGEST", company)).toBe(true);
  });

  it("applies company grants to every scope", () => {
    const member = actor({ grants: [{ permission: "SUGGEST", scope: company }] });
    expect(canAccess(member, "SUGGEST", company)).toBe(true);
    expect(canAccess(member, "SUGGEST", operations)).toBe(true);
  });

  it("lets department readers see company and their department, not siblings", () => {
    const member = actor({ grants: [{ permission: "READ", scope: marketing }] });
    expect(canAccess(member, "READ", company)).toBe(true);
    expect(canAccess(member, "READ", marketing)).toBe(true);
    expect(canAccess(member, "READ", operations)).toBe(false);
  });

  it("keeps department suggestion and approval exact while approval includes read", () => {
    const member = actor({ grants: [{ permission: "APPROVE", scope: operations }] });
    expect(canAccess(member, "APPROVE", operations)).toBe(true);
    expect(canAccess(member, "READ", operations)).toBe(true);
    expect(canAccess(member, "APPROVE", company)).toBe(false);
    expect(canAccess(member, "APPROVE", marketing)).toBe(false);
  });

  it("keeps confidential knowledge owner-only and rejects cross-company records", () => {
    const member = actor({ grants: [{ permission: "READ", scope: marketing }] });
    expect(isMemoryEligible(memory(marketing, "CONFIDENTIAL"), member, ["MARKETING"])).toBe(false);
    expect(isMemoryEligible({ ...memory(), record: { ...memory().record, companyId: "company-2" } }, member, ["MARKETING"])).toBe(false);
    expect(isMemoryEligible(memory(marketing, "CONFIDENTIAL"), actor({ roles: ["OWNER"] }), ["MARKETING"])).toBe(true);
  });
});
