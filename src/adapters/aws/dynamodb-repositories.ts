import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  TransactWriteCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { createHash } from "node:crypto";
import demoFixture from "../../../fixtures/demo-company.json";
import { appError } from "@/domain/errors";
import { env } from "@/lib/env";
import {
  candidateSchema,
  companyMembershipSchema,
  companySchema,
  conversationSchema,
  memoryRecordSchema,
  memoryVersionSchema,
  messageSchema,
} from "@/domain/schemas";
import type {
  AuditEvent,
  Company,
  CompanyMembership,
  Conversation,
  HydratedMemory,
  MemoryCandidate,
  MemoryRecord,
  MemoryVersion,
  Message,
  IdentityProvider,
} from "@/domain/types";
import type { CompanyRepository } from "@/ports/company-repository";
import type { MembershipRepository } from "@/ports/membership-repository";
import type { ConversationRepository } from "@/ports/conversation-repository";
import type {
  ApproveCandidateCommand,
  ApproveCandidateAsVersionCommand,
  ApproveCandidateResult,
  CreateApprovedMemoryCommand,
  CreateMemoryVersionCommand,
  MemoryRepository,
} from "@/ports/memory-repository";

type Item = Record<string, unknown>;

function companyPk(companyId: string): string { return `COMPANY#${companyId}`; }
function candidateSk(id: string): string { return `CANDIDATE#${id}`; }
function memorySk(id: string): string { return `MEMORY#${id}`; }
function conversationSk(id: string): string { return `CONVERSATION#${id}`; }
function membershipSk(id: string): string { return `MEMBER#${id}`; }
function messagePk(companyId: string, conversationId: string): string {
  return `${companyPk(companyId)}#CONVERSATION#${conversationId}`;
}
function memoryVersionPk(companyId: string, memoryId: string): string {
  return `${companyPk(companyId)}#MEMORY#${memoryId}`;
}
function versionSk(version: number): string { return `VERSION#${String(version).padStart(8, "0")}`; }

function withoutKeys(item: Item): Item {
  const value = { ...item };
  delete value.PK;
  delete value.SK;
  delete value.GSI1PK;
  delete value.GSI1SK;
  delete value.entity;
  return value;
}

function parseCompany(item: Item): Company { return companySchema.parse(withoutKeys(item)); }
function parseConversation(item: Item): Conversation { return conversationSchema.parse(withoutKeys(item)); }
function parseMessage(item: Item): Message { return messageSchema.parse(withoutKeys(item)); }
function parseMembership(item: Item): CompanyMembership { return companyMembershipSchema.parse(withoutKeys(item)); }

export class DynamoRepositories implements CompanyRepository, ConversationRepository, MemoryRepository, MembershipRepository {
  constructor(
    private readonly client: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  async get(companyId: string): Promise<Company | null>;
  async get(conversationId: string, companyId: string): Promise<Conversation | null>;
  async get(first: string, second?: string): Promise<Company | Conversation | null> {
    const isConversation = second !== undefined;
    const result = await this.client.send(new GetCommand({
      TableName: this.tableName,
      Key: isConversation
        ? { PK: companyPk(second), SK: conversationSk(first) }
        : { PK: companyPk(first), SK: "PROFILE" },
      ConsistentRead: true,
    }));
    if (!result.Item) return null;
    return isConversation ? parseConversation(result.Item) : parseCompany(result.Item);
  }

  async update(company: Company): Promise<Company>;
  async update(company: Company): Promise<Company> {
    await this.client.send(new PutCommand({
      TableName: this.tableName,
      Item: { PK: companyPk(company.id), SK: "PROFILE", entity: "COMPANY", ...company },
      ConditionExpression: "attribute_exists(PK)",
    }));
    return company;
  }

  async resetDemo(companyId: string): Promise<Company> {
    const company = structuredClone(demoFixture.company) as Company;
    if (company.id !== companyId) throw new Error("FORBIDDEN");
    const existing = await this.client.send(new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: "PK = :pk",
      ExpressionAttributeValues: { ":pk": companyPk(company.id) },
      ProjectionExpression: "PK, SK",
    }));
    const childPartitions = (existing.Items ?? []).flatMap((item) => {
      if (typeof item.SK !== "string") return [];
      if (item.SK.startsWith("CONVERSATION#")) {
        return [messagePk(company.id, item.SK.slice("CONVERSATION#".length))];
      }
      if (item.SK.startsWith("MEMORY#")) {
        return [memoryVersionPk(company.id, item.SK.slice("MEMORY#".length))];
      }
      return [];
    });
    for (const partitionKey of childPartitions) await this.deletePartition(partitionKey);
    for (const item of existing.Items ?? []) {
      if (typeof item.SK === "string" && item.SK.startsWith("MEMBER#")) continue;
      await this.client.send(new DeleteCommand({
        TableName: this.tableName,
        Key: { PK: item.PK, SK: item.SK },
      }));
    }
    await this.client.send(new PutCommand({
      TableName: this.tableName,
      Item: { PK: companyPk(company.id), SK: "PROFILE", entity: "COMPANY", ...company },
    }));
    if (env.AUTH_MODE === "demo") {
      for (const value of demoFixture.memberships) {
        const membership = companyMembershipSchema.parse(value);
        await this.client.send(new PutCommand({
          TableName: this.tableName,
          Item: this.membershipItem(membership),
        }));
      }
    }
    return company;
  }

  async listMemberships(companyId: string): Promise<CompanyMembership[]> {
    const result = await this.client.send(new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
      ExpressionAttributeValues: { ":pk": companyPk(companyId), ":prefix": "MEMBER#" },
      ConsistentRead: true,
    }));
    return (result.Items ?? []).map(parseMembership)
      .sort((left, right) => left.displayName.localeCompare(right.displayName));
  }

  async getMembership(companyId: string, userId: string): Promise<CompanyMembership | null> {
    const result = await this.client.send(new GetCommand({
      TableName: this.tableName,
      Key: { PK: companyPk(companyId), SK: membershipSk(userId) },
      ConsistentRead: true,
    }));
    return result.Item ? parseMembership(result.Item) : null;
  }

  async getMembershipByEmail(companyId: string, email: string): Promise<CompanyMembership | null> {
    const normalized = email.trim().toLowerCase();
    return (await this.listMemberships(companyId)).find((membership) => membership.email === normalized) ?? null;
  }

  async findMembershipByIdentity(
    provider: IdentityProvider,
    subject: string,
  ): Promise<CompanyMembership | null> {
    const result = await this.client.send(new QueryCommand({
      TableName: this.tableName,
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :pk",
      ExpressionAttributeValues: { ":pk": `IDENTITY#${provider}#${subject}` },
      Limit: 2,
    }));
    const memberships = (result.Items ?? []).map(parseMembership);
    if (memberships.length > 1) throw appError("CONFIGURATION_ERROR");
    return memberships[0] ?? null;
  }

  async createMembership(membership: CompanyMembership): Promise<CompanyMembership> {
    await this.client.send(new PutCommand({
      TableName: this.tableName,
      Item: this.membershipItem(membership),
      ConditionExpression: "attribute_not_exists(PK)",
    }));
    return membership;
  }

  async updateMembership(membership: CompanyMembership): Promise<CompanyMembership> {
    await this.client.send(new PutCommand({
      TableName: this.tableName,
      Item: this.membershipItem(membership),
      ConditionExpression: "attribute_exists(PK)",
    }));
    return membership;
  }

  async create(conversation: Conversation): Promise<Conversation> {
    await this.client.send(new PutCommand({
      TableName: this.tableName,
      Item: {
        PK: companyPk(conversation.companyId),
        SK: conversationSk(conversation.id),
        GSI1PK: `${companyPk(conversation.companyId)}#CONVERSATION#${conversation.assistantRole}`,
        GSI1SK: `${conversation.updatedAt}#${conversation.id}`,
        entity: "CONVERSATION",
        ...conversation,
      },
      ConditionExpression: "attribute_not_exists(PK)",
    }));
    return conversation;
  }

  async list(companyId: string): Promise<Conversation[]> {
    const result = await this.client.send(new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
      ExpressionAttributeValues: { ":pk": companyPk(companyId), ":prefix": "CONVERSATION#" },
      ConsistentRead: true,
    }));
    return (result.Items ?? [])
      .map(parseConversation)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  async listMessages(conversationId: string, companyId: string): Promise<Message[]> {
    const conversation = await this.get(conversationId, companyId);
    if (!conversation) return [];
    const result = await this.client.send(new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
      ExpressionAttributeValues: { ":pk": messagePk(companyId, conversationId), ":prefix": "MESSAGE#" },
      ConsistentRead: true,
    }));
    return (result.Items ?? []).map(parseMessage);
  }

  async appendMessage(message: Message, idempotencyKey?: string): Promise<Message> {
    const item = {
      PK: messagePk(message.companyId, message.conversationId),
      SK: `MESSAGE#${message.createdAt}#${message.id}`,
      entity: "MESSAGE",
      ...message,
    };
    if (!idempotencyKey) {
      await this.client.send(new PutCommand({
        TableName: this.tableName,
        Item: item,
        ConditionExpression: "attribute_not_exists(PK)",
      }));
      await this.touchConversation(message);
      return message;
    }
    try {
      await this.client.send(new TransactWriteCommand({
        ClientRequestToken: createHash("sha256")
          .update(`${message.companyId}:${message.conversationId}:${idempotencyKey}`)
          .digest("hex").slice(0, 36),
        TransactItems: [
          { Put: { TableName: this.tableName, Item: item, ConditionExpression: "attribute_not_exists(PK)" } },
          { Put: {
            TableName: this.tableName,
            Item: {
              PK: messagePk(message.companyId, message.conversationId),
              SK: `IDEMPOTENCY#${idempotencyKey}`,
              entity: "MESSAGE_IDEMPOTENCY",
              companyId: message.companyId,
              conversationId: message.conversationId,
              idempotencyKey,
              message,
            },
            ConditionExpression: "attribute_not_exists(PK)",
          } },
        ],
      }));
      await this.touchConversation(message);
      return message;
    } catch (error) {
      const existing = await this.findMessageByIdempotencyKey(
        message.companyId,
        message.conversationId,
        idempotencyKey,
      );
      if (existing) return existing;
      throw error;
    }
  }

  async findMessageByIdempotencyKey(
    companyId: string,
    conversationId: string,
    idempotencyKey: string,
  ): Promise<Message | null> {
    const result = await this.client.send(new GetCommand({
      TableName: this.tableName,
      Key: { PK: messagePk(companyId, conversationId), SK: `IDEMPOTENCY#${idempotencyKey}` },
      ConsistentRead: true,
    }));
    if (!result.Item || result.Item.companyId !== companyId) return null;
    return messageSchema.parse(result.Item.message);
  }

  async createCandidate(candidate: MemoryCandidate): Promise<MemoryCandidate> {
    await this.client.send(new PutCommand({
      TableName: this.tableName,
      Item: this.candidateItem(candidate),
      ConditionExpression: "attribute_not_exists(PK)",
    }));
    return candidate;
  }

  async listCandidates(companyId: string): Promise<MemoryCandidate[]> {
    const statuses = ["PROPOSED", "APPROVING", "APPROVED", "REJECTED"] as const;
    const results = await Promise.all(statuses.map((status) => this.client.send(new QueryCommand({
      TableName: this.tableName,
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :pk",
      ExpressionAttributeValues: { ":pk": `${companyPk(companyId)}#CANDIDATE#${status}` },
    }))));
    return results.flatMap((result) => result.Items ?? [])
      .map((item) => candidateSchema.parse(withoutKeys(item)))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async getCandidate(candidateId: string, companyId: string): Promise<MemoryCandidate | null> {
    const result = await this.client.send(new GetCommand({
      TableName: this.tableName,
      Key: { PK: companyPk(companyId), SK: candidateSk(candidateId) },
      ConsistentRead: true,
    }));
    return result.Item ? candidateSchema.parse(withoutKeys(result.Item)) : null;
  }

  async updateCandidate(candidate: MemoryCandidate): Promise<MemoryCandidate> {
    await this.client.send(new PutCommand({
      TableName: this.tableName,
      Item: this.candidateItem(candidate),
      ConditionExpression: "attribute_exists(PK) AND #version = :expected",
      ExpressionAttributeNames: { "#version": "version" },
      ExpressionAttributeValues: { ":expected": candidate.version - 1 },
    }));
    return candidate;
  }

  async listCurrent(companyId: string): Promise<HydratedMemory[]> {
    const result = await this.client.send(new QueryCommand({
      TableName: this.tableName,
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :pk",
      ExpressionAttributeValues: { ":pk": `${companyPk(companyId)}#MEMORY#APPROVED` },
    }));
    const records = (result.Items ?? []).map((item) => memoryRecordSchema.parse(withoutKeys(item)));
    return (await Promise.all(records.map((record) => this.hydrateRecord(record))))
      .filter((memory): memory is HydratedMemory => memory !== null);
  }

  async getCurrent(memoryId: string, companyId: string): Promise<HydratedMemory | null> {
    const result = await this.client.send(new GetCommand({
      TableName: this.tableName,
      Key: { PK: companyPk(companyId), SK: memorySk(memoryId) },
      ConsistentRead: true,
    }));
    if (!result.Item) return null;
    return this.hydrateRecord(memoryRecordSchema.parse(withoutKeys(result.Item)));
  }

  async listVersions(memoryId: string, companyId: string): Promise<MemoryVersion[]> {
    if (!await this.getCurrent(memoryId, companyId)) throw appError("NOT_FOUND");
    const result = await this.client.send(new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :version)",
      ExpressionAttributeValues: { ":pk": memoryVersionPk(companyId, memoryId), ":version": "VERSION#" },
      ScanIndexForward: false,
      ConsistentRead: true,
    }));
    return (result.Items ?? []).map((item) => memoryVersionSchema.parse(withoutKeys(item)));
  }

  async approveCandidate(command: ApproveCandidateCommand): Promise<ApproveCandidateResult> {
    const candidate = await this.getCandidate(command.candidateId, command.companyId);
    if (!candidate) throw appError("NOT_FOUND");
    if (candidate.status === "APPROVED" && candidate.approvedMemoryId) {
      const existing = await this.getCurrent(candidate.approvedMemoryId, command.companyId);
      if (existing) return { memory: existing, created: false };
    }
    if (candidate.status !== "PROPOSED") throw appError("CONFLICT");
    if (candidate.version !== command.expectedCandidateVersion) throw appError("STALE_WRITE");
    const memory = this.buildApprovedMemory(candidate, command);
    const approvedCandidate: MemoryCandidate = {
      ...candidate,
      status: "APPROVED",
      approvedMemoryId: memory.record.id,
      reviewedBy: command.actorId,
      reviewedAt: command.approvedAt,
    };
    const audits = this.approvalAudits(command);
    try {
      await this.client.send(new TransactWriteCommand({
        ClientRequestToken: createHash("sha256").update(command.idempotencyKey).digest("hex").slice(0, 36),
        TransactItems: [
          { Put: {
            TableName: this.tableName,
            Item: this.candidateItem(approvedCandidate),
            ConditionExpression: "#status = :proposed AND #version = :version",
            ExpressionAttributeNames: { "#status": "status", "#version": "version" },
            ExpressionAttributeValues: { ":proposed": "PROPOSED", ":version": command.expectedCandidateVersion },
          } },
          { Put: { TableName: this.tableName, Item: this.memoryItem(memory.record), ConditionExpression: "attribute_not_exists(PK)" } },
          { Put: { TableName: this.tableName, Item: this.versionItem(memory.version), ConditionExpression: "attribute_not_exists(PK)" } },
          ...audits.map((audit) => ({ Put: { TableName: this.tableName, Item: this.auditItem(audit), ConditionExpression: "attribute_not_exists(PK)" } })),
        ],
      }));
      return { memory, created: true };
    } catch (error) {
      const latest = await this.getCandidate(command.candidateId, command.companyId);
      if (latest?.status === "APPROVED" && latest.approvedMemoryId) {
        const existing = await this.getCurrent(latest.approvedMemoryId, command.companyId);
        if (existing) return { memory: existing, created: false };
      }
      throw error;
    }
  }

  async approveCandidateAsVersion(command: ApproveCandidateAsVersionCommand): Promise<ApproveCandidateResult> {
    const candidate = await this.getCandidate(command.candidateId, command.companyId);
    if (!candidate) throw appError("NOT_FOUND");
    if (candidate.status === "APPROVED" && candidate.approvedMemoryId) {
      const existing = await this.getCurrent(candidate.approvedMemoryId, command.companyId);
      if (existing) return { memory: existing, created: false };
    }
    if (candidate.status !== "PROPOSED") throw appError("CONFLICT");
    if (candidate.version !== command.expectedCandidateVersion) throw appError("STALE_WRITE");
    const current = await this.getCurrent(command.memoryId, command.companyId);
    if (!current) throw appError("NOT_FOUND");
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
    const approvedCandidate: MemoryCandidate = {
      ...candidate,
      status: "APPROVED",
      approvedMemoryId: command.memoryId,
      reviewedBy: command.actorId,
      reviewedAt: command.approvedAt,
    };
    const audits: AuditEvent[] = [
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
    ];
    try {
      await this.client.send(new TransactWriteCommand({
        ClientRequestToken: createHash("sha256").update(command.idempotencyKey).digest("hex").slice(0, 36),
        TransactItems: [
          { Put: {
            TableName: this.tableName,
            Item: this.candidateItem(approvedCandidate),
            ConditionExpression: "#status = :proposed AND #version = :candidateVersion",
            ExpressionAttributeNames: { "#status": "status", "#version": "version" },
            ExpressionAttributeValues: { ":proposed": "PROPOSED", ":candidateVersion": command.expectedCandidateVersion },
          } },
          { Put: {
            TableName: this.tableName,
            Item: this.memoryItem(record),
            ConditionExpression: "#status = :approved AND currentVersion = :memoryVersion",
            ExpressionAttributeNames: { "#status": "status" },
            ExpressionAttributeValues: { ":approved": "APPROVED", ":memoryVersion": command.expectedMemoryVersion },
          } },
          { Put: {
            TableName: this.tableName,
            Item: this.versionItem(version),
            ConditionExpression: "attribute_not_exists(PK)",
          } },
          ...audits.map((audit) => ({ Put: {
            TableName: this.tableName,
            Item: this.auditItem(audit),
            ConditionExpression: "attribute_not_exists(PK)",
          } })),
        ],
      }));
      return { memory: { record, version }, created: true };
    } catch (error) {
      const latestCandidate = await this.getCandidate(command.candidateId, command.companyId);
      if (latestCandidate?.status === "APPROVED" && latestCandidate.approvedMemoryId) {
        const existing = await this.getCurrent(latestCandidate.approvedMemoryId, command.companyId);
        if (existing) return { memory: existing, created: false };
      }
      const latestMemory = await this.getCurrent(command.memoryId, command.companyId);
      if (latestMemory && latestMemory.record.currentVersion !== command.expectedMemoryVersion) {
        throw appError("STALE_WRITE", false, error);
      }
      throw error;
    }
  }

  async createVersion(command: CreateMemoryVersionCommand): Promise<HydratedMemory> {
    const current = await this.getCurrent(command.memoryId, command.companyId);
    if (!current) throw appError("NOT_FOUND");
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
    const audit: AuditEvent = {
      id: `audit-${crypto.randomUUID()}`,
      companyId: command.companyId,
      actorId: command.actorId,
      action: "MEMORY_VERSION_CREATED",
      targetType: "MEMORY_VERSION",
      targetId: `${command.memoryId}:v${version.version}`,
      createdAt: command.approvedAt,
    };
    try {
      await this.client.send(new TransactWriteCommand({
        TransactItems: [
          { Put: {
            TableName: this.tableName,
            Item: this.memoryItem(record),
            ConditionExpression: "#status = :approved AND currentVersion = :expected",
            ExpressionAttributeNames: { "#status": "status" },
            ExpressionAttributeValues: { ":approved": "APPROVED", ":expected": command.expectedMemoryVersion },
          } },
          { Put: {
            TableName: this.tableName,
            Item: this.versionItem(version),
            ConditionExpression: "attribute_not_exists(PK)",
          } },
          { Put: {
            TableName: this.tableName,
            Item: this.auditItem(audit),
            ConditionExpression: "attribute_not_exists(PK)",
          } },
        ],
      }));
      return { record, version };
    } catch (error) {
      const latest = await this.getCurrent(command.memoryId, command.companyId);
      if (latest && latest.record.currentVersion !== command.expectedMemoryVersion) {
        throw appError("STALE_WRITE", false, error);
      }
      throw error;
    }
  }

  async createApprovedMemory(command: CreateApprovedMemoryCommand): Promise<HydratedMemory> {
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
    const audit: AuditEvent = {
      id: `audit-${crypto.randomUUID()}`,
      companyId: command.companyId,
      actorId: command.actorId,
      action: "MEMORY_VERSION_CREATED",
      targetType: "MEMORY_VERSION",
      targetId: `${command.memoryId}:v1`,
      createdAt: command.approvedAt,
    };
    await this.client.send(new TransactWriteCommand({
      ClientRequestToken: createHash("sha256")
        .update(`${command.companyId}:${command.memoryId}`)
        .digest("hex")
        .slice(0, 36),
      TransactItems: [
        { Put: { TableName: this.tableName, Item: this.memoryItem(record), ConditionExpression: "attribute_not_exists(PK)" } },
        { Put: { TableName: this.tableName, Item: this.versionItem(version), ConditionExpression: "attribute_not_exists(PK)" } },
        { Put: { TableName: this.tableName, Item: this.auditItem(audit), ConditionExpression: "attribute_not_exists(PK)" } },
      ],
    }));
    return { record, version };
  }

  async updateRecord(record: MemoryRecord): Promise<void> {
    await this.client.send(new PutCommand({
      TableName: this.tableName,
      Item: this.memoryItem(record),
      ConditionExpression: "attribute_exists(PK) AND currentVersion = :version",
      ExpressionAttributeValues: { ":version": record.currentVersion },
    }));
  }

  async appendAudit(event: AuditEvent): Promise<void> {
    await this.client.send(new PutCommand({ TableName: this.tableName, Item: this.auditItem(event) }));
  }

  private candidateItem(candidate: MemoryCandidate): Item {
    return {
      PK: companyPk(candidate.companyId), SK: candidateSk(candidate.id), entity: "CANDIDATE",
      GSI1PK: `${companyPk(candidate.companyId)}#CANDIDATE#${candidate.status}`,
      GSI1SK: `${candidate.createdAt}#${candidate.id}`,
      ...candidate,
    };
  }

  private membershipItem(membership: CompanyMembership): Item {
    return {
      PK: companyPk(membership.companyId),
      SK: membershipSk(membership.userId),
      GSI1PK: `IDENTITY#${membership.identityProvider}#${membership.identitySubject}`,
      GSI1SK: companyPk(membership.companyId),
      entity: "MEMBERSHIP",
      ...membership,
    };
  }

  private memoryItem(record: MemoryRecord): Item {
    return {
      PK: companyPk(record.companyId), SK: memorySk(record.id), entity: "MEMORY",
      GSI1PK: `${companyPk(record.companyId)}#MEMORY#${record.status}`,
      GSI1SK: `${record.updatedAt}#${record.id}`,
      ...record,
    };
  }

  private versionItem(version: MemoryVersion): Item {
    return {
      PK: memoryVersionPk(version.companyId, version.memoryId),
      SK: versionSk(version.version),
      entity: "MEMORY_VERSION",
      ...version,
    };
  }

  private auditItem(event: AuditEvent): Item {
    return { PK: companyPk(event.companyId), SK: `AUDIT#${event.createdAt}#${event.id}`, entity: "AUDIT", ...event };
  }

  private async hydrateRecord(record: MemoryRecord): Promise<HydratedMemory | null> {
    const result = await this.client.send(new GetCommand({
      TableName: this.tableName,
      Key: { PK: memoryVersionPk(record.companyId, record.id), SK: versionSk(record.currentVersion) },
      ConsistentRead: true,
    }));
    return result.Item
      ? { record, version: memoryVersionSchema.parse(withoutKeys(result.Item)) }
      : null;
  }

  private async touchConversation(message: Message): Promise<void> {
    await this.client.send(new UpdateCommand({
      TableName: this.tableName,
      Key: { PK: companyPk(message.companyId), SK: conversationSk(message.conversationId) },
      UpdateExpression: "SET updatedAt = :updatedAt, GSI1SK = :gsi1sk",
      ExpressionAttributeValues: {
        ":updatedAt": message.createdAt,
        ":gsi1sk": `${message.createdAt}#${message.conversationId}`,
      },
      ConditionExpression: "attribute_exists(PK)",
    }));
  }

  private async deletePartition(partitionKey: string): Promise<void> {
    const result = await this.client.send(new QueryCommand({
      TableName: this.tableName,
      KeyConditionExpression: "PK = :pk",
      ExpressionAttributeValues: { ":pk": partitionKey },
      ProjectionExpression: "PK, SK",
      ConsistentRead: true,
    }));
    for (const item of result.Items ?? []) {
      await this.client.send(new DeleteCommand({
        TableName: this.tableName,
        Key: { PK: item.PK, SK: item.SK },
      }));
    }
  }

  private buildApprovedMemory(candidate: MemoryCandidate, command: ApproveCandidateCommand): HydratedMemory {
    const record: MemoryRecord = {
      id: command.memoryId, companyId: candidate.companyId, type: candidate.type,
      status: "APPROVED", currentVersion: 1, title: candidate.title,
      scope: candidate.scope,
      appliesToRoles: candidate.appliesToRoles, sensitivity: candidate.sensitivity,
      tags: candidate.tags, effectiveFrom: command.approvedAt, createdAt: command.approvedAt,
      updatedAt: command.approvedAt, indexStatus: "PENDING",
    };
    const version: MemoryVersion = {
      memoryId: command.memoryId, companyId: candidate.companyId, version: 1,
      title: candidate.title, statement: candidate.statement, rationale: candidate.rationale,
      scope: candidate.scope,
      appliesToRoles: candidate.appliesToRoles, sensitivity: candidate.sensitivity,
      tags: candidate.tags, effectiveFrom: command.approvedAt, sourceRefs: candidate.sourceRefs,
      approvedBy: command.actorId, approvedAt: command.approvedAt,
      originatingCandidateId: candidate.id, createdAt: command.approvedAt,
    };
    return { record, version };
  }

  private approvalAudits(command: ApproveCandidateCommand): AuditEvent[] {
    return ["CANDIDATE_APPROVED", "MEMORY_VERSION_CREATED"].map((action, index) => ({
      id: `audit-${crypto.randomUUID()}`, companyId: command.companyId,
      actorId: command.actorId, action, targetType: index === 0 ? "MEMORY" : "MEMORY_VERSION",
      targetId: index === 0 ? command.memoryId : `${command.memoryId}:v1`, createdAt: command.approvedAt,
    }));
  }
}
