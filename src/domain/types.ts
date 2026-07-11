export type CompanyRole =
  | "OWNER"
  | "MANAGER"
  | "MARKETING"
  | "OPERATIONS"
  | "SALES"
  | "FRONT_DESK"
  | "EMPLOYEE";

export type AssistantRole = "MARKETING" | "OPERATIONS" | "EMPLOYEE";
export type MemoryType =
  | "COMPANY_FACT"
  | "CUSTOMER_INSIGHT"
  | "BRAND_RULE"
  | "POLICY"
  | "DECISION"
  | "SOP"
  | "LESSON";
export type CandidateStatus = "PROPOSED" | "APPROVING" | "APPROVED" | "REJECTED";
export type MemoryStatus = "APPROVED" | "SUPERSEDED" | "ARCHIVED";
export type IndexStatus = "NOT_INDEXED" | "PENDING" | "READY" | "FAILED";
export type ConflictRelation =
  | "UNRELATED"
  | "DUPLICATE"
  | "UPDATE"
  | "CONTRADICTION"
  | "EXCEPTION";
export type Sensitivity = "PUBLIC" | "INTERNAL" | "CONFIDENTIAL";

export interface ActorContext {
  userId: string;
  companyId: string;
  roles: CompanyRole[];
  demoMode: boolean;
}

export interface Company {
  id: string;
  name: string;
  description: string;
  productsOrServices: string[];
  primaryCustomers: string[];
  differentiators: string[];
  brandVoice: string[];
  timezone: string;
  createdAt: string;
  updatedAt: string;
}

export interface SourceReference {
  sourceId: string;
  label: string;
  messageId?: string;
  excerpt?: string;
}

export interface Conversation {
  id: string;
  companyId: string;
  title: string;
  assistantRole: AssistantRole;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  companyId: string;
  conversationId: string;
  actorType: "USER" | "ASSISTANT" | "SYSTEM_EVENT";
  actorId?: string;
  content: string;
  sourceRefs: SourceReference[];
  createdAt: string;
}

export interface MemoryCandidate {
  id: string;
  version: number;
  companyId: string;
  conversationId?: string;
  type: MemoryType;
  title: string;
  statement: string;
  rationale: string | null;
  rationaleMissing: boolean;
  appliesToRoles: CompanyRole[];
  tags: string[];
  sensitivity: Sensitivity;
  sourceRefs: SourceReference[];
  confidence: number;
  relation: ConflictRelation;
  relatedMemoryIds: string[];
  status: CandidateStatus;
  extractionPromptVersion: string;
  modelId: string;
  createdBy: string;
  createdAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  approvedMemoryId?: string;
}

export interface MemoryRecord {
  id: string;
  companyId: string;
  type: MemoryType;
  status: MemoryStatus;
  currentVersion: number;
  title: string;
  appliesToRoles: CompanyRole[];
  sensitivity: Sensitivity;
  tags: string[];
  effectiveFrom: string;
  createdAt: string;
  updatedAt: string;
  indexStatus: IndexStatus;
  indexDocumentId?: string;
  indexErrorCode?: string;
}

export interface MemoryVersion {
  memoryId: string;
  companyId: string;
  version: number;
  title: string;
  statement: string;
  rationale: string | null;
  appliesToRoles: CompanyRole[];
  sensitivity: Sensitivity;
  tags: string[];
  effectiveFrom: string;
  sourceRefs: SourceReference[];
  approvedBy: string;
  approvedAt: string;
  originatingCandidateId?: string;
  createdAt: string;
}

export interface HydratedMemory {
  record: MemoryRecord;
  version: MemoryVersion;
}

export interface SopDraft {
  title: string;
  purpose: string;
  ownerRole: string;
  trigger: string;
  prerequisites: string[];
  steps: Array<{ order: number; action: string; ownerRole: string; expectedResult: string }>;
  qualityChecks: string[];
  exceptions: string[];
  escalation: string[];
  inputs: string[];
  outputs: string[];
  assumptions: string[];
  sourceMemories: Array<{ memoryId: string; version: number }>;
}

export interface AuditEvent {
  id: string;
  companyId: string;
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  createdAt: string;
}

export interface GroundedAnswer {
  answer: string;
  groundingStatus: "GROUNDED" | "NO_APPROVED_CONTEXT" | "CONFLICTING_CONTEXT";
  sourceMemories: Array<{
    memoryId: string;
    version: number;
    title: string;
    approvedAt: string;
  }>;
}
