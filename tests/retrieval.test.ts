import { describe, expect, it } from "vitest";
import { isMemoryEligible } from "@/domain/retrieval";
import type { ActorContext, HydratedMemory } from "@/domain/types";

const actor: ActorContext = { userId: "employee", companyId: "company-a", roles: ["EMPLOYEE"], demoMode: true };
const memory: HydratedMemory = {
  record: { id: "memory", companyId: "company-a", type: "POLICY", status: "APPROVED", currentVersion: 1, title: "Policy", appliesToRoles: ["EMPLOYEE"], sensitivity: "INTERNAL", tags: [], effectiveFrom: "2026-07-11T00:00:00.000Z", createdAt: "2026-07-11T00:00:00.000Z", updatedAt: "2026-07-11T00:00:00.000Z", indexStatus: "READY" },
  version: { memoryId: "memory", companyId: "company-a", version: 1, title: "Policy", statement: "A current rule.", rationale: null, appliesToRoles: ["EMPLOYEE"], sensitivity: "INTERNAL", tags: [], effectiveFrom: "2026-07-11T00:00:00.000Z", sourceRefs: [{ sourceId: "source", label: "Owner statement" }], approvedBy: "owner", approvedAt: "2026-07-11T00:00:00.000Z", createdAt: "2026-07-11T00:00:00.000Z" },
};

describe("retrieval eligibility", () => {
  it("accepts only current, ready, company-and-role-scoped memory", () => {
    expect(isMemoryEligible(memory, actor)).toBe(true);
    expect(isMemoryEligible({ ...memory, record: { ...memory.record, status: "ARCHIVED" } }, actor)).toBe(false);
    expect(isMemoryEligible({ ...memory, record: { ...memory.record, indexStatus: "PENDING" } }, actor)).toBe(false);
    expect(isMemoryEligible({ ...memory, record: { ...memory.record, companyId: "company-b" } }, actor)).toBe(false);
    expect(isMemoryEligible({ ...memory, record: { ...memory.record, appliesToRoles: ["OWNER"] } }, actor)).toBe(false);
    expect(isMemoryEligible({ ...memory, version: { ...memory.version, version: 2 } }, actor)).toBe(false);
    expect(isMemoryEligible({ ...memory, record: { ...memory.record, appliesToRoles: ["MARKETING"] } }, { ...actor, roles: ["OWNER"] })).toBe(true);
  });
});
