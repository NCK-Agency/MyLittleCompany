import { describe, expect, it } from "vitest";
import { renderMemoryDocument } from "@/domain/render-memory";
import type { HydratedMemory } from "@/domain/types";

describe("renderMemoryDocument", () => {
  it("is deterministic and includes provenance", () => {
    const memory = {
      record: { id: "m1", companyId: "c1", type: "DECISION", status: "APPROVED", currentVersion: 1, title: "Discount limit", appliesToRoles: ["MARKETING"], sensitivity: "INTERNAL", tags: [], effectiveFrom: "2026-07-11T00:00:00.000Z", createdAt: "2026-07-11T00:00:00.000Z", updatedAt: "2026-07-11T00:00:00.000Z", indexStatus: "READY" },
      version: { memoryId: "m1", companyId: "c1", version: 1, title: "Discount limit", statement: "Never exceed 15%.", rationale: "Protect margins.", appliesToRoles: ["MARKETING"], sensitivity: "INTERNAL", tags: [], effectiveFrom: "2026-07-11T00:00:00.000Z", sourceRefs: [{ sourceId: "s1", label: "Owner conversation" }], approvedBy: "owner", approvedAt: "2026-07-11T00:00:00.000Z", createdAt: "2026-07-11T00:00:00.000Z" },
    } satisfies HydratedMemory;
    expect(renderMemoryDocument(memory)).toBe(renderMemoryDocument(memory));
    expect(renderMemoryDocument(memory)).toContain("Owner conversation");
    expect(renderMemoryDocument(memory)).toContain("Protect margins.");
  });
});
