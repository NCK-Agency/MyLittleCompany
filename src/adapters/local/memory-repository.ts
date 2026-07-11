import { appError } from "@/domain/errors";
import type {
  AuditEvent,
  HydratedMemory,
  MemoryCandidate,
  MemoryRecord,
  MemoryVersion,
} from "@/domain/types";
import type {
  ApproveCandidateCommand,
  ApproveCandidateAsVersionCommand,
  ApproveCandidateResult,
  CreateApprovedMemoryCommand,
  CreateMemoryVersionCommand,
  MemoryRepository,
} from "@/ports/memory-repository";
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
    const index = state.candidates.findIndex(
      (item) => item.id === candidate.id && item.companyId === candidate.companyId,
    );
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

  async listVersions(memoryId: string, companyId: string): Promise<MemoryVersion[]> {
    return getDemoState().memoryVersions
      .filter((version) => version.memoryId === memoryId && version.companyId === companyId)
      .sort((left, right) => right.version - left.version);
  }

  async approveCandidate(command: ApproveCandidateCommand): Promise<ApproveCandidateResult> {
    const state = getDemoState();
    const candidateIndex = state.candidates.findIndex(
      (candidate) => candidate.id === command.candidateId && candidate.companyId === command.companyId,
    );
    if (candidateIndex < 0) throw appError("NOT_FOUND");
    const candidate = state.candidates[candidateIndex];
    if (candidate.status === "APPROVED" && candidate.approvedMemoryId) {
      const memory = state.memories.find((item) => item.record.id === candidate.approvedMemoryId);
      if (memory) return { memory, created: false };
    }
    if (candidate.status !== "PROPOSED") throw appError("CONFLICT");
    if (candidate.version !== command.expectedCandidateVersion) throw appError("STALE_WRITE");
    const id = command.memoryId;
    const record: MemoryRecord = {
      id,
      companyId: candidate.companyId,
      type: candidate.type,
      status: "APPROVED",
      currentVersion: 1,
      title: candidate.title,
      scope: candidate.scope,
      appliesToRoles: candidate.appliesToRoles,
      sensitivity: candidate.sensitivity,
      tags: candidate.tags,
      effectiveFrom: command.approvedAt,
      createdAt: command.approvedAt,
      updatedAt: command.approvedAt,
      indexStatus: "PENDING",
    };
    const version: MemoryVersion = {
      memoryId: id,
      companyId: candidate.companyId,
      version: 1,
      title: candidate.title,
      scope: candidate.scope,
      statement: candidate.statement,
      rationale: candidate.rationale,
      appliesToRoles: candidate.appliesToRoles,
      sensitivity: candidate.sensitivity,
      tags: candidate.tags,
      effectiveFrom: command.approvedAt,
      sourceRefs: candidate.sourceRefs,
      approvedBy: command.actorId,
      approvedAt: command.approvedAt,
      originatingCandidateId: candidate.id,
      createdAt: command.approvedAt,
    };
    const memory = { record, version };
    state.memories.push(memory);
    state.memoryVersions.push(version);
    state.candidates[candidateIndex] = {
      ...candidate,
      status: "APPROVED",
      approvedMemoryId: id,
      reviewedBy: command.actorId,
      reviewedAt: command.approvedAt,
    };
    state.auditEvents.push(
      {
        id: `audit-${crypto.randomUUID()}`,
        companyId: command.companyId,
        actorId: command.actorId,
        action: "CANDIDATE_APPROVED",
        targetType: "MEMORY",
        targetId: id,
        createdAt: command.approvedAt,
      },
      {
        id: `audit-${crypto.randomUUID()}`,
        companyId: command.companyId,
        actorId: command.actorId,
        action: "MEMORY_VERSION_CREATED",
        targetType: "MEMORY_VERSION",
        targetId: `${id}:v1`,
        createdAt: command.approvedAt,
      },
    );
    saveDemoState(state);
    return { memory, created: true };
  }

  async approveCandidateAsVersion(command: ApproveCandidateAsVersionCommand): Promise<ApproveCandidateResult> {
    const state = getDemoState();
    const candidateIndex = state.candidates.findIndex(
      (candidate) => candidate.id === command.candidateId && candidate.companyId === command.companyId,
    );
    if (candidateIndex < 0) throw appError("NOT_FOUND");
    const candidate = state.candidates[candidateIndex];
    if (candidate.status === "APPROVED" && candidate.approvedMemoryId) {
      const existing = state.memories.find((item) => item.record.id === candidate.approvedMemoryId);
      if (existing) return { memory: existing, created: false };
    }
    if (candidate.status !== "PROPOSED") throw appError("CONFLICT");
    if (candidate.version !== command.expectedCandidateVersion) throw appError("STALE_WRITE");
    const memoryIndex = state.memories.findIndex(
      (memory) => memory.record.id === command.memoryId && memory.record.companyId === command.companyId,
    );
    if (memoryIndex < 0) throw appError("NOT_FOUND");
    const current = state.memories[memoryIndex];
    if (current.record.status !== "APPROVED") throw appError("CONFLICT");
    if (current.record.currentVersion !== command.expectedMemoryVersion) throw appError("STALE_WRITE");
    const version: MemoryVersion = {
      memoryId: current.record.id,
      companyId: current.record.companyId,
      version: current.record.currentVersion + 1,
      title: candidate.title,
      scope: candidate.scope,
      statement: candidate.statement,
      rationale: candidate.rationale,
      appliesToRoles: candidate.appliesToRoles,
      sensitivity: candidate.sensitivity,
      tags: candidate.tags,
      effectiveFrom: command.approvedAt,
      sourceRefs: candidate.sourceRefs,
      approvedBy: command.actorId,
      approvedAt: command.approvedAt,
      originatingCandidateId: candidate.id,
      createdAt: command.approvedAt,
    };
    const record: MemoryRecord = {
      ...current.record,
      currentVersion: version.version,
      title: version.title,
      scope: version.scope,
      appliesToRoles: version.appliesToRoles,
      sensitivity: version.sensitivity,
      tags: version.tags,
      effectiveFrom: version.effectiveFrom,
      updatedAt: command.approvedAt,
      indexStatus: "PENDING",
      indexDocumentId: undefined,
      indexErrorCode: undefined,
    };
    const memory = { record, version };
    state.memories[memoryIndex] = memory;
    state.memoryVersions.push(version);
    state.candidates[candidateIndex] = {
      ...candidate,
      status: "APPROVED",
      approvedMemoryId: command.memoryId,
      reviewedBy: command.actorId,
      reviewedAt: command.approvedAt,
    };
    state.auditEvents.push(
      {
        id: `audit-${crypto.randomUUID()}`,
        companyId: command.companyId,
        actorId: command.actorId,
        action: "CANDIDATE_APPROVED_AS_VERSION",
        targetType: "MEMORY",
        targetId: command.memoryId,
        createdAt: command.approvedAt,
      },
      {
        id: `audit-${crypto.randomUUID()}`,
        companyId: command.companyId,
        actorId: command.actorId,
        action: "MEMORY_VERSION_CREATED",
        targetType: "MEMORY_VERSION",
        targetId: `${command.memoryId}:v${version.version}`,
        createdAt: command.approvedAt,
      },
    );
    saveDemoState(state);
    return { memory, created: true };
  }

  async createVersion(command: CreateMemoryVersionCommand): Promise<HydratedMemory> {
    const state = getDemoState();
    const memoryIndex = state.memories.findIndex(
      (memory) => memory.record.id === command.memoryId && memory.record.companyId === command.companyId,
    );
    if (memoryIndex < 0) throw appError("NOT_FOUND");
    const current = state.memories[memoryIndex];
    if (current.record.status !== "APPROVED") throw appError("CONFLICT");
    if (current.record.currentVersion !== command.expectedMemoryVersion) throw appError("STALE_WRITE");

    const version: MemoryVersion = {
      memoryId: current.record.id,
      companyId: current.record.companyId,
      version: current.record.currentVersion + 1,
      title: command.title,
      scope: command.scope,
      statement: command.statement,
      rationale: command.rationale,
      appliesToRoles: command.appliesToRoles,
      sensitivity: command.sensitivity,
      tags: command.tags,
      effectiveFrom: command.approvedAt,
      sourceRefs: command.sourceRefs,
      approvedBy: command.actorId,
      approvedAt: command.approvedAt,
      createdAt: command.approvedAt,
    };
    const record: MemoryRecord = {
      ...current.record,
      currentVersion: version.version,
      title: version.title,
      scope: version.scope,
      appliesToRoles: version.appliesToRoles,
      sensitivity: version.sensitivity,
      tags: version.tags,
      effectiveFrom: version.effectiveFrom,
      updatedAt: command.approvedAt,
      indexStatus: "PENDING",
      indexDocumentId: undefined,
      indexErrorCode: undefined,
    };
    const memory = { record, version };
    state.memories[memoryIndex] = memory;
    state.memoryVersions.push(version);
    state.auditEvents.push({
      id: `audit-${crypto.randomUUID()}`,
      companyId: command.companyId,
      actorId: command.actorId,
      action: "MEMORY_VERSION_CREATED",
      targetType: "MEMORY_VERSION",
      targetId: `${command.memoryId}:v${version.version}`,
      createdAt: command.approvedAt,
    });
    saveDemoState(state);
    return memory;
  }

  async createApprovedMemory(command: CreateApprovedMemoryCommand): Promise<HydratedMemory> {
    const state = getDemoState();
    if (state.memories.some((item) => item.record.id === command.memoryId)) throw appError("CONFLICT");
    const record: MemoryRecord = {
      id: command.memoryId,
      companyId: command.companyId,
      type: command.type,
      status: "APPROVED",
      currentVersion: 1,
      title: command.title,
      scope: command.scope,
      appliesToRoles: command.appliesToRoles,
      sensitivity: command.sensitivity,
      tags: command.tags,
      effectiveFrom: command.approvedAt,
      createdAt: command.approvedAt,
      updatedAt: command.approvedAt,
      indexStatus: "PENDING",
    };
    const version: MemoryVersion = {
      memoryId: command.memoryId,
      companyId: command.companyId,
      version: 1,
      title: command.title,
      scope: command.scope,
      statement: command.statement,
      rationale: command.rationale,
      appliesToRoles: command.appliesToRoles,
      sensitivity: command.sensitivity,
      tags: command.tags,
      effectiveFrom: command.approvedAt,
      sourceRefs: command.sourceRefs,
      approvedBy: command.actorId,
      approvedAt: command.approvedAt,
      createdAt: command.approvedAt,
    };
    const memory = { record, version };
    state.memories.push(memory);
    state.memoryVersions.push(version);
    state.auditEvents.push({
      id: `audit-${crypto.randomUUID()}`,
      companyId: command.companyId,
      actorId: command.actorId,
      action: "MEMORY_VERSION_CREATED",
      targetType: "MEMORY_VERSION",
      targetId: `${command.memoryId}:v1`,
      createdAt: command.approvedAt,
    });
    saveDemoState(state);
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
