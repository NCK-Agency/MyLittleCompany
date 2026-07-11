import type { CandidateStatus, IndexStatus, MemoryStatus } from "./types";

export class DomainTransitionError extends Error {
  readonly code = "ILLEGAL_STATE_TRANSITION";
}

function transition<T extends string>(current: T, next: T, allowed: Record<T, T[]>): T {
  if (!allowed[current].includes(next)) {
    throw new DomainTransitionError(`Cannot transition ${current} to ${next}`);
  }
  return next;
}

export function transitionCandidate(current: CandidateStatus, next: CandidateStatus): CandidateStatus {
  return transition(current, next, {
    PROPOSED: ["APPROVING", "REJECTED"],
    APPROVING: ["PROPOSED", "APPROVED"],
    APPROVED: [],
    REJECTED: [],
  });
}

export function transitionMemory(current: MemoryStatus, next: MemoryStatus): MemoryStatus {
  return transition(current, next, {
    APPROVED: ["SUPERSEDED", "ARCHIVED"],
    SUPERSEDED: [],
    ARCHIVED: [],
  });
}

export function transitionIndex(current: IndexStatus, next: IndexStatus): IndexStatus {
  return transition(current, next, {
    NOT_INDEXED: ["PENDING"],
    PENDING: ["READY", "FAILED"],
    READY: ["PENDING"],
    FAILED: ["PENDING"],
  });
}
