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
export type OrganizationalUnitType = "COMPANY" | "DEPARTMENT";
export type KnowledgePermission = "READ" | "SUGGEST" | "APPROVE";
export type IdentityProvider = "DEMO" | "COGNITO";
export type MembershipStatus = "INVITED" | "ACTIVE" | "DISABLED";
export type SourceKind = "CONVERSATION" | "WEBSITE" | "DOCUMENT" | "MANUAL";
export type ImportProvider = "PASTE" | "CHATGPT" | "WHATSAPP" | "GOOGLE_DRIVE" | "UPLOAD";
export type OnboardingState =
  | "GOAL"
  | "SOURCE"
  | "PROCESSING"
  | "REVIEWING"
  | "PROVING"
  | "COMPLETED"
  | "SKIPPED";
export type ImportBatchState = "DRAFT" | "PROCESSING" | "COMPLETED" | "FAILED" | "CANCELLED";
export type ImportStage = "NORMALIZE" | "EXTRACT" | "CLASSIFY" | "FINALIZE";
export type ImportedItemState = "QUEUED" | "PARSING" | "READY" | "FAILED" | "CANCELLED";
export type RawContentStatus = "ACTIVE" | "DELETED" | "REDACTED";
export type SourceRetention = "UNAPPROVED_30_DAYS" | "ZERO_CANDIDATE_24_HOURS" | "ALL_IGNORED_7_DAYS" | "APPROVED" | "DELETED";

export interface KnowledgeScope {
  level: OrganizationalUnitType;
  organizationalUnitId?: string;
}

export interface AccessGrant {
  permission: KnowledgePermission;
  scope: KnowledgeScope;
}

export interface CompanyMembership {
  companyId: string;
  userId: string;
  email: string;
  displayName: string;
  identityProvider: IdentityProvider;
  identitySubject: string;
  roles: CompanyRole[];
  grants: AccessGrant[];
  status: MembershipStatus;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationalUnit {
  id: string;
  companyId: string;
  parentId: string | null;
  type: OrganizationalUnitType;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface ActorContext {
  userId: string;
  companyId: string;
  email: string;
  displayName: string;
  roles: CompanyRole[];
  grants: AccessGrant[];
  organizationalUnitIds?: string[];
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
  organizationalUnits: OrganizationalUnit[];
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

export interface ImportedSource {
  id: string;
  companyId: string;
  kind: SourceKind;
  provider: ImportProvider;
  title: string;
  externalId?: string;
  checksum: string;
  storageKey?: string;
  contentStatus: RawContentStatus;
  retention: SourceRetention;
  deleteAfter?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface StoredImportedSource {
  source: ImportedSource;
  content: string | null;
}

export interface OnboardingSession {
  id: string;
  version: number;
  companyId: string;
  createdBy: string;
  proofQuestion: string;
  state: OnboardingState;
  activeBatchId?: string;
  prioritizedCandidateIds: string[];
  approvedMemoryIds: string[];
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface ImportBatch {
  id: string;
  version: number;
  companyId: string;
  sessionId: string;
  createdBy: string;
  provider: ImportProvider;
  state: ImportBatchState;
  stage: ImportStage;
  idempotencyKey: string;
  checksum: string;
  itemIds: string[];
  candidateIds: string[];
  readyItemCount: number;
  failedItemCount: number;
  leaseOwner?: string;
  leaseExpiresAt?: string;
  errorCode?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ImportedItem {
  id: string;
  companyId: string;
  batchId: string;
  sourceId: string;
  kind: SourceKind;
  provider: ImportProvider;
  title: string;
  externalId?: string;
  checksum: string;
  contentLength: number;
  state: ImportedItemState;
  errorCode?: string;
  deleteAfter?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Conversation {
  id: string;
  companyId: string;
  title: string;
  assistantRole: AssistantRole;
  scope: KnowledgeScope;
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
  scope: KnowledgeScope;
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
  scope: KnowledgeScope;
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
  scope: KnowledgeScope;
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

export interface MemoryDetail extends HydratedMemory {
  history: MemoryVersion[];
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

export interface KnowledgeIndexHit {
  memoryId: string;
  version: number;
  score?: number;
  metadata: {
    companyId: string;
    status: string;
    roleScopes: string[];
    sensitivity: string;
  };
}

export interface CanonicalMemoryDocument {
  companyId: string;
  memoryId: string;
  version: number;
  key: string;
  uri: string;
  checksum: string;
}

export interface ModelOperationMetadata {
  modelId: string;
  promptVersion: string;
  latencyMs: number;
  inputTokens?: number;
  outputTokens?: number;
  providerRequestId?: string;
}
