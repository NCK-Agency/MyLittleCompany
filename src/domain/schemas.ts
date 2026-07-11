import { z } from "zod";

export const companyRoleSchema = z.enum([
  "OWNER",
  "MANAGER",
  "MARKETING",
  "OPERATIONS",
  "SALES",
  "FRONT_DESK",
  "EMPLOYEE",
]);
export const memoryTypeSchema = z.enum([
  "COMPANY_FACT",
  "CUSTOMER_INSIGHT",
  "BRAND_RULE",
  "POLICY",
  "DECISION",
  "SOP",
  "LESSON",
]);
export const knowledgeScopeSchema = z.object({
  level: z.enum(["COMPANY", "DEPARTMENT"]),
  organizationalUnitId: z.string().min(1).max(128).optional(),
}).superRefine((scope, context) => {
  if (scope.level === "DEPARTMENT" && !scope.organizationalUnitId) {
    context.addIssue({ code: "custom", message: "Choose a department for department knowledge." });
  }
  if (scope.level === "COMPANY" && scope.organizationalUnitId) {
    context.addIssue({ code: "custom", message: "Company knowledge cannot target a department." });
  }
});
export const knowledgePermissionSchema = z.enum(["READ", "SUGGEST", "APPROVE"]);
export const accessGrantSchema = z.object({
  permission: knowledgePermissionSchema,
  scope: knowledgeScopeSchema,
});
export const companyMembershipSchema = z.object({
  companyId: z.string().min(1).max(128),
  userId: z.string().min(1).max(128),
  email: z.email().max(320).transform((value) => value.trim().toLowerCase()),
  displayName: z.string().trim().min(1).max(120),
  identityProvider: z.enum(["DEMO", "COGNITO"]),
  identitySubject: z.string().min(1).max(256),
  roles: z.array(companyRoleSchema).min(1).max(10),
  grants: z.array(accessGrantSchema).max(100),
  status: z.enum(["INVITED", "ACTIVE", "DISABLED"]),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export const waitlistEntrySchema = z.object({
  id: z.uuid(),
  email: z.email().max(320).transform((value) => value.trim().toLowerCase()),
  displayName: z.string().trim().min(1).max(120).optional(),
  companyName: z.string().trim().min(1).max(160).optional(),
  status: z.literal("WAITING"),
  source: z.literal("PUBLIC_SITE"),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export const joinWaitlistSchema = z.object({
  email: z.string().trim().max(320).pipe(z.email()).transform((value) => value.toLowerCase()),
  displayName: z.string().trim().max(120).optional().transform((value) => value || undefined),
  companyName: z.string().trim().max(160).optional().transform((value) => value || undefined),
  website: z.string().trim().max(300).optional().transform((value) => value || undefined),
});
export const organizationalUnitSchema = z.object({
  id: z.string().min(1).max(128),
  companyId: z.string().min(1).max(128),
  parentId: z.string().min(1).max(128).nullable(),
  type: z.enum(["COMPANY", "DEPARTMENT"]),
  name: z.string().min(1).max(120),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export const sourceReferenceSchema = z.object({
  sourceId: z.string().min(1).max(128),
  label: z.string().min(1).max(200),
  messageId: z.string().min(1).max(128).optional(),
  excerpt: z.string().max(300).optional(),
});
export const sourceKindSchema = z.enum(["CONVERSATION", "WEBSITE", "DOCUMENT", "MANUAL"]);
export const importProviderSchema = z.enum(["PASTE", "CHATGPT", "WHATSAPP", "GOOGLE_DRIVE", "UPLOAD"]);
export const importedSourceSchema = z.object({
  id: z.string().min(1).max(128),
  companyId: z.string().min(1).max(128),
  kind: sourceKindSchema,
  provider: importProviderSchema,
  title: z.string().trim().min(1).max(200),
  externalId: z.string().min(1).max(256).optional(),
  checksum: z.string().regex(/^[a-f0-9]{64}$/),
  storageKey: z.string().min(1).max(512).optional(),
  contentStatus: z.enum(["ACTIVE", "DELETED", "REDACTED"]),
  retention: z.enum(["UNAPPROVED_30_DAYS", "ZERO_CANDIDATE_24_HOURS", "ALL_IGNORED_7_DAYS", "APPROVED", "DELETED"]).default("UNAPPROVED_30_DAYS"),
  deleteAfter: z.iso.datetime().optional(),
  createdBy: z.string().min(1).max(128),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export const onboardingSessionSchema = z.object({
  id: z.string().min(1).max(128),
  version: z.number().int().positive(),
  companyId: z.string().min(1).max(128),
  createdBy: z.string().min(1).max(128),
  proofQuestion: z.string().trim().min(3).max(500),
  state: z.enum(["GOAL", "SOURCE", "PROCESSING", "REVIEWING", "PROVING", "COMPLETED", "SKIPPED"]),
  activeBatchId: z.string().min(1).max(128).optional(),
  prioritizedCandidateIds: z.array(z.string().min(1).max(128)).max(3),
  approvedMemoryIds: z.array(z.string().min(1).max(128)).max(12),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  completedAt: z.iso.datetime().optional(),
});
export const importBatchSchema = z.object({
  id: z.string().min(1).max(128),
  version: z.number().int().positive(),
  companyId: z.string().min(1).max(128),
  sessionId: z.string().min(1).max(128),
  createdBy: z.string().min(1).max(128),
  provider: importProviderSchema,
  state: z.enum(["DRAFT", "PROCESSING", "COMPLETED", "FAILED", "CANCELLED"]),
  stage: z.enum(["NORMALIZE", "EXTRACT", "CLASSIFY", "FINALIZE"]),
  idempotencyKey: z.string().min(8).max(256),
  checksum: z.string().regex(/^[a-f0-9]{64}$/),
  itemIds: z.array(z.string().min(1).max(128)).min(1).max(10),
  candidateIds: z.array(z.string().min(1).max(128)).max(12),
  readyItemCount: z.number().int().nonnegative(),
  failedItemCount: z.number().int().nonnegative(),
  leaseOwner: z.string().min(1).max(128).optional(),
  leaseExpiresAt: z.iso.datetime().optional(),
  errorCode: z.string().min(1).max(80).optional(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export const importedItemSchema = z.object({
  id: z.string().min(1).max(128),
  companyId: z.string().min(1).max(128),
  batchId: z.string().min(1).max(128),
  sourceId: z.string().min(1).max(128),
  kind: sourceKindSchema,
  provider: importProviderSchema,
  title: z.string().trim().min(1).max(200),
  externalId: z.string().min(1).max(256).optional(),
  checksum: z.string().regex(/^[a-f0-9]{64}$/),
  contentLength: z.number().int().positive().max(40_000),
  state: z.enum(["QUEUED", "PARSING", "READY", "FAILED", "CANCELLED"]),
  errorCode: z.string().min(1).max(80).optional(),
  deleteAfter: z.iso.datetime().optional(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const createOnboardingSessionSchema = z.object({
  proofQuestion: z.string().trim().min(3).max(500),
});
export const createImportSchema = z.object({
  sessionId: z.string().min(1).max(128),
  provider: z.enum(["PASTE", "CHATGPT"]),
  title: z.string().trim().min(1).max(200),
  content: z.string().trim().min(1).max(40_000),
  externalId: z.string().min(1).max(256).optional(),
  idempotencyKey: z.string().min(8).max(256),
});
export const proveOnboardingSchema = z.object({
  question: z.string().trim().min(3).max(500).optional(),
});
export const companySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(120),
  description: z.string().min(1).max(2000),
  productsOrServices: z.array(z.string().min(1).max(200)).max(50),
  primaryCustomers: z.array(z.string().min(1).max(200)).max(50),
  differentiators: z.array(z.string().min(1).max(300)).max(50),
  brandVoice: z.array(z.string().min(1).max(100)).max(30),
  organizationalUnits: z.array(organizationalUnitSchema).max(100).default([]),
  timezone: z.string().min(1).max(100),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export const conversationSchema = z.object({
  id: z.string().min(1),
  companyId: z.string().min(1),
  title: z.string().min(1).max(120),
  assistantRole: z.enum(["MARKETING", "OPERATIONS", "EMPLOYEE"]),
  scope: knowledgeScopeSchema.default({ level: "COMPANY" }),
  createdBy: z.string().min(1),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export const messageSchema = z.object({
  id: z.string().min(1),
  companyId: z.string().min(1),
  conversationId: z.string().min(1),
  actorType: z.enum(["USER", "ASSISTANT", "SYSTEM_EVENT"]),
  actorId: z.string().min(1).optional(),
  content: z.string().max(20_000),
  sourceRefs: z.array(sourceReferenceSchema).max(50),
  createdAt: z.iso.datetime(),
});
export const candidateSchema = z.object({
  id: z.string().min(1),
  version: z.number().int().positive(),
  companyId: z.string().min(1),
  conversationId: z.string().optional(),
  scope: knowledgeScopeSchema.default({ level: "COMPANY" }),
  type: memoryTypeSchema,
  title: z.string().min(3).max(120),
  statement: z.string().min(3).max(2000),
  rationale: z.string().max(2000).nullable(),
  rationaleMissing: z.boolean(),
  appliesToRoles: z.array(companyRoleSchema).min(1).max(10),
  tags: z.array(z.string().min(1).max(40)).max(10),
  sensitivity: z.enum(["PUBLIC", "INTERNAL", "CONFIDENTIAL"]),
  sourceRefs: z.array(sourceReferenceSchema).min(1).max(10),
  confidence: z.number().min(0).max(1),
  relation: z.enum(["UNRELATED", "DUPLICATE", "UPDATE", "CONTRADICTION", "EXCEPTION"]),
  relatedMemoryIds: z.array(z.string()).max(10),
  status: z.enum(["PROPOSED", "APPROVING", "APPROVED", "REJECTED"]),
  extractionPromptVersion: z.string().min(1),
  modelId: z.string().min(1),
  createdBy: z.string().min(1),
  createdAt: z.iso.datetime(),
  reviewedBy: z.string().optional(),
  reviewedAt: z.iso.datetime().optional(),
  approvedMemoryId: z.string().optional(),
});
export const memoryRecordSchema = z.object({
  id: z.string().min(1),
  companyId: z.string().min(1),
  type: memoryTypeSchema,
  status: z.enum(["APPROVED", "SUPERSEDED", "ARCHIVED"]),
  currentVersion: z.number().int().positive(),
  title: z.string().min(3).max(120),
  scope: knowledgeScopeSchema.default({ level: "COMPANY" }),
  appliesToRoles: z.array(companyRoleSchema).min(1).max(10),
  sensitivity: z.enum(["PUBLIC", "INTERNAL", "CONFIDENTIAL"]),
  tags: z.array(z.string().max(40)).max(10),
  effectiveFrom: z.iso.datetime(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  indexStatus: z.enum(["NOT_INDEXED", "PENDING", "READY", "FAILED"]),
  indexDocumentId: z.string().optional(),
  indexErrorCode: z.string().optional(),
});
export const memoryVersionSchema = z.object({
  memoryId: z.string().min(1),
  companyId: z.string().min(1),
  version: z.number().int().positive(),
  title: z.string().min(3).max(120),
  scope: knowledgeScopeSchema.default({ level: "COMPANY" }),
  statement: z.string().min(3).max(2000),
  rationale: z.string().max(2000).nullable(),
  appliesToRoles: z.array(companyRoleSchema).min(1),
  sensitivity: z.enum(["PUBLIC", "INTERNAL", "CONFIDENTIAL"]),
  tags: z.array(z.string().max(40)).max(10),
  effectiveFrom: z.iso.datetime(),
  sourceRefs: z.array(sourceReferenceSchema).min(1),
  approvedBy: z.string().min(1),
  approvedAt: z.iso.datetime(),
  originatingCandidateId: z.string().optional(),
  createdAt: z.iso.datetime(),
});
export const sopDraftSchema = z.object({
  title: z.string().min(3).max(160),
  purpose: z.string().min(3).max(1000),
  ownerRole: z.string().min(1).max(80),
  trigger: z.string().min(1).max(500),
  prerequisites: z.array(z.string().min(1).max(500)).max(20),
  steps: z.array(z.object({
    order: z.number().int().positive(),
    action: z.string().min(1).max(1000),
    ownerRole: z.string().min(1).max(80),
    expectedResult: z.string().min(1).max(500),
  })).min(1).max(30),
  qualityChecks: z.array(z.string().min(1).max(500)).max(20),
  exceptions: z.array(z.string().min(1).max(500)).max(20),
  escalation: z.array(z.string().min(1).max(500)).max(20),
  inputs: z.array(z.string().min(1).max(300)).max(20),
  outputs: z.array(z.string().min(1).max(300)).max(20),
  assumptions: z.array(z.string().min(1).max(500)).max(20),
  sourceMemories: z.array(z.object({ memoryId: z.string(), version: z.number().int().positive() })).max(20),
});

export const sendMessageSchema = z.object({
  content: z.string().trim().min(1).max(4000),
  idempotencyKey: z.string().min(8).max(128),
});
export const createConversationSchema = z.object({
  assistantRole: z.enum(["MARKETING", "OPERATIONS", "EMPLOYEE"]),
  title: z.string().trim().min(1).max(120),
  scope: knowledgeScopeSchema.default({ level: "COMPANY" }),
});
export const updateCandidateSchema = z.object({
  expectedCandidateVersion: z.number().int().positive(),
  title: z.string().min(3).max(120),
  statement: z.string().min(3).max(2000),
  rationale: z.string().max(2000).nullable(),
  appliesToRoles: z.array(companyRoleSchema).min(1).max(10),
  tags: z.array(z.string().max(40)).max(10),
});

export const resolveCandidateSchema = z.object({
  expectedCandidateVersion: z.number().int().positive(),
  resolution: z.enum(["UPDATE", "REPLACE", "EXCEPTION"]),
  condition: z.string().trim().min(3).max(500).optional(),
}).superRefine((value, context) => {
  if (value.resolution === "EXCEPTION" && !value.condition) {
    context.addIssue({ code: "custom", path: ["condition"], message: "Write the condition for this exception." });
  }
});

export const amendMemorySchema = z.object({
  expectedMemoryVersion: z.number().int().positive(),
  title: z.string().trim().min(3).max(120),
  statement: z.string().trim().min(3).max(2000),
  rationale: z.string().trim().max(2000).nullable(),
  appliesToRoles: z.array(companyRoleSchema).min(1).max(10),
  scope: knowledgeScopeSchema,
});

export const createMemoryPageSchema = z.object({
  title: z.string().trim().min(3).max(120),
  statement: z.string().trim().min(3).max(2000),
  rationale: z.string().trim().max(2000).nullable(),
  type: memoryTypeSchema,
  appliesToRoles: z.array(companyRoleSchema).min(1).max(10),
  sensitivity: z.enum(["PUBLIC", "INTERNAL", "CONFIDENTIAL"]).default("INTERNAL"),
  tags: z.array(z.string().trim().min(1).max(40)).max(10).default([]),
  scope: knowledgeScopeSchema,
  conversationId: z.string().min(1).max(128).optional(),
  sourceMessageIds: z.array(z.string().min(1).max(128)).max(20).default([]),
});

export const inviteMembershipSchema = z.object({
  email: z.email().max(320).transform((value) => value.trim().toLowerCase()),
  displayName: z.string().trim().min(1).max(120),
  roles: z.array(companyRoleSchema.exclude(["OWNER"])).min(1).max(10),
  grants: z.array(accessGrantSchema).max(100),
});

export const updateMembershipSchema = z.object({
  displayName: z.string().trim().min(1).max(120),
  roles: z.array(companyRoleSchema.exclude(["OWNER"])).min(1).max(10),
  grants: z.array(accessGrantSchema).max(100),
  status: z.enum(["INVITED", "ACTIVE", "DISABLED"]),
});

export const createManualCandidateSchema = z.object({
  type: memoryTypeSchema,
  title: z.string().trim().min(3).max(120),
  statement: z.string().trim().min(3).max(2000),
  rationale: z.string().trim().max(2000).nullable(),
  appliesToRoles: z.array(companyRoleSchema).min(1).max(10),
  tags: z.array(z.string().trim().min(1).max(40)).max(10).default([]),
  sensitivity: z.enum(["PUBLIC", "INTERNAL", "CONFIDENTIAL"]).default("INTERNAL"),
  scope: knowledgeScopeSchema,
});
