import type { AuditEvent, HydratedMemory, MemoryCandidate, MemoryRecord } from "@/domain/types";

export interface MemoryRepository {
  createCandidate(candidate: MemoryCandidate): Promise<MemoryCandidate>;
  listCandidates(companyId: string): Promise<MemoryCandidate[]>;
  getCandidate(candidateId: string, companyId: string): Promise<MemoryCandidate | null>;
  updateCandidate(candidate: MemoryCandidate): Promise<MemoryCandidate>;
  listCurrent(companyId: string): Promise<HydratedMemory[]>;
  getCurrent(memoryId: string, companyId: string): Promise<HydratedMemory | null>;
  createApproved(candidate: MemoryCandidate, actorId: string, now: string): Promise<HydratedMemory>;
  updateRecord(record: MemoryRecord): Promise<void>;
  appendAudit(event: AuditEvent): Promise<void>;
}
