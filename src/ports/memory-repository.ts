import type {
  AuditEvent,
  CompanyRole,
  HydratedMemory,
  KnowledgeScope,
  MemoryCandidate,
  MemoryRecord,
  MemoryVersion,
  Sensitivity,
  SourceReference,
} from "@/domain/types";

export interface ApproveCandidateCommand {
  companyId: string;
  candidateId: string;
  expectedCandidateVersion: number;
  actorId: string;
  approvedAt: string;
  memoryId: string;
  idempotencyKey: string;
}

export interface ApproveCandidateResult {
  memory: HydratedMemory;
  created: boolean;
}

export interface ApproveCandidateAsVersionCommand {
  companyId: string;
  candidateId: string;
  expectedCandidateVersion: number;
  memoryId: string;
  expectedMemoryVersion: number;
  actorId: string;
  approvedAt: string;
  idempotencyKey: string;
}

export interface CreateMemoryVersionCommand {
  companyId: string;
  memoryId: string;
  expectedMemoryVersion: number;
  title: string;
  scope: KnowledgeScope;
  statement: string;
  rationale: string | null;
  appliesToRoles: CompanyRole[];
  tags: string[];
  sensitivity: Sensitivity;
  sourceRefs: SourceReference[];
  actorId: string;
  approvedAt: string;
}

export interface CreateApprovedMemoryCommand {
  companyId: string;
  memoryId: string;
  type: MemoryRecord["type"];
  title: string;
  statement: string;
  rationale: string | null;
  scope: KnowledgeScope;
  appliesToRoles: CompanyRole[];
  tags: string[];
  sensitivity: Sensitivity;
  sourceRefs: SourceReference[];
  actorId: string;
  approvedAt: string;
}

export interface MemoryRepository {
  createCandidate(candidate: MemoryCandidate): Promise<MemoryCandidate>;
  listCandidates(companyId: string): Promise<MemoryCandidate[]>;
  getCandidate(candidateId: string, companyId: string): Promise<MemoryCandidate | null>;
  updateCandidate(candidate: MemoryCandidate): Promise<MemoryCandidate>;
  listCurrent(companyId: string): Promise<HydratedMemory[]>;
  getCurrent(memoryId: string, companyId: string): Promise<HydratedMemory | null>;
  listVersions(memoryId: string, companyId: string): Promise<MemoryVersion[]>;
  approveCandidate(command: ApproveCandidateCommand): Promise<ApproveCandidateResult>;
  approveCandidateAsVersion(command: ApproveCandidateAsVersionCommand): Promise<ApproveCandidateResult>;
  createApprovedMemory(command: CreateApprovedMemoryCommand): Promise<HydratedMemory>;
  createVersion(command: CreateMemoryVersionCommand): Promise<HydratedMemory>;
  updateRecord(record: MemoryRecord): Promise<void>;
  appendAudit(event: AuditEvent): Promise<void>;
}
