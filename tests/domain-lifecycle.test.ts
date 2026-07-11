import { describe, expect, it } from "vitest";
import { DomainTransitionError, transitionCandidate, transitionIndex, transitionMemory } from "@/domain/lifecycle";

describe("memory lifecycles", () => {
  it("allows the approval, archival, and index retry paths", () => {
    expect(transitionCandidate("PROPOSED", "APPROVING")).toBe("APPROVING");
    expect(transitionCandidate("APPROVING", "APPROVED")).toBe("APPROVED");
    expect(transitionMemory("APPROVED", "ARCHIVED")).toBe("ARCHIVED");
    expect(transitionIndex("PENDING", "FAILED")).toBe("FAILED");
    expect(transitionIndex("FAILED", "PENDING")).toBe("PENDING");
    expect(transitionIndex("PENDING", "READY")).toBe("READY");
  });

  it("rejects illegal transitions", () => {
    expect(() => transitionCandidate("REJECTED", "APPROVED")).toThrow(DomainTransitionError);
    expect(() => transitionMemory("ARCHIVED", "APPROVED")).toThrow(DomainTransitionError);
  });
});
