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
export const sourceReferenceSchema = z.object({
  sourceId: z.string().min(1).max(128),
  label: z.string().min(1).max(200),
  messageId: z.string().min(1).max(128).optional(),
  excerpt: z.string().max(300).optional(),
});
export const candidateSchema = z.object({
  id: z.string().min(1),
  version: z.number().int().positive(),
  companyId: z.string().min(1),
  conversationId: z.string().optional(),
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
});
export const updateCandidateSchema = z.object({
  expectedCandidateVersion: z.number().int().positive(),
  title: z.string().min(3).max(120),
  statement: z.string().min(3).max(2000),
  rationale: z.string().max(2000).nullable(),
  appliesToRoles: z.array(companyRoleSchema).min(1).max(10),
  tags: z.array(z.string().max(40)).max(10),
});
