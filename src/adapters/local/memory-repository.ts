import { transitionCandidate } from "@/domain/lifecycle";
import type {
  AuditEvent,
  HydratedMemory,
  MemoryCandidate,
  MemoryRecord,
  MemoryVersion,
} from "@/domain/types";
import type { MemoryRepository } from "@/ports/memory-repository";
import { getDemoState, saveDemoState } from "./demo-state";

export class LocalMemoryRepository implements MemoryRepository {
  async createCandidate(candidate: MemoryCandidate): Promise<MemoryCandidate> {
    const state = getDemoState();
    state.candidates.push(candidate);
    saveDemoState(state);
    return candidate;
  }

  async listCandidates(companyId: string): Promise<MemoryCandidate[]> {
    return getDemoState().candidates
      .filter((candidate) => candidate.companyId === companyId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async getCandidate(candidateId: string, companyId: string): Promise<MemoryCandidate | null> {
    return getDemoState().candidates.find(
      (candidate) => candidate.id === candidateId && candidate.companyId === companyId,
    ) ?? null;
  }

  async updateCandidate(candidate: MemoryCandidate): Promise<MemoryCandidate> {
    const state = getDemoState();
    const index = state.candidates.findIndex((item) => item.id === candidate.id);
    if (index < 0) throw new Error("Candidate not found");
    state.candidates[index] = candidate;
    saveDemoState(state);
    return candidate;
  }

  async listCurrent(companyId: string): Promise<HydratedMemory[]> {
    return getDemoState().memories.filter((memory) => memory.record.companyId === companyId);
  }

  async getCurrent(memoryId: string, companyId: string): Promise<HydratedMemory | null> {
    return getDemoState().memories.find(
      (memory) => memory.record.id === memoryId && memory.record.companyId === companyId,
    ) ?? null;
  }

  async createApproved(candidate: MemoryCandidate, actorId: string, now: string): Promise<HydratedMemory> {
    if (candidate.status !== "APPROVING") throw new Error("Candidate is not approving");
    const id = `mem-${crypto.randomUUID()}`;
    const record: MemoryRecord = {
      id,
      companyId: candidate.companyId,
      type: candidate.type,
      status: "APPROVED",
      currentVersion: 1,
      title: candidate.title,
      appliesToRoles: candidate.appliesToRoles,
      sensitivity: candidate.sensitivity,
      tags: candidate.tags,
      effectiveFrom: now,
      createdAt: now,
      updatedAt: now,
      indexStatus: "PENDING",
    };
    const version: MemoryVersion = {
      memoryId: id,
      companyId: candidate.companyId,
      version: 1,
      title: candidate.title,
      statement: candidate.statement,
      rationale: candidate.rationale,
      appliesToRoles: candidate.appliesToRoles,
      sensitivity: candidate.sensitivity,
      tags: candidate.tags,
      effectiveFrom: now,
      sourceRefs: candidate.sourceRefs,
      approvedBy: actorId,
      approvedAt: now,
      originatingCandidateId: candidate.id,
      createdAt: now,
    };
    const memory = { record, version };
    const state = getDemoState();
    state.memories.push(memory);
    saveDemoState(state);
    candidate.status = transitionCandidate(candidate.status, "APPROVED");
    candidate.approvedMemoryId = id;
    candidate.reviewedBy = actorId;
    candidate.reviewedAt = now;
    await this.updateCandidate(candidate);
    return memory;
  }

  async updateRecord(record: MemoryRecord): Promise<void> {
    const state = getDemoState();
    const memory = state.memories.find((item) => item.record.id === record.id);
    if (!memory) throw new Error("Memory not found");
    memory.record = record;
    saveDemoState(state);
  }

  async appendAudit(event: AuditEvent): Promise<void> {
    const state = getDemoState();
    state.auditEvents.push(event);
    saveDemoState(state);
  }
}
