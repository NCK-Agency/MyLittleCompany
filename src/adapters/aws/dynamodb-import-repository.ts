import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  TransactWriteCommand,
} from "@aws-sdk/lib-dynamodb";
import { createHash } from "node:crypto";
import { appError } from "@/domain/errors";
import { importBatchSchema, importedItemSchema, onboardingSessionSchema } from "@/domain/schemas";
import type { ImportBatch, ImportedItem, OnboardingSession } from "@/domain/types";
import type { ImportRepository } from "@/ports/import-repository";

type Item = Record<string, unknown>;

function companyPk(companyId: string): string { return `COMPANY#${companyId}`; }
function withoutKeys(item: Item): Item {
  const value = { ...item };
  delete value.PK;
  delete value.SK;
  delete value.GSI1PK;
  delete value.GSI1SK;
  delete value.entity;
  return value;
}

export class DynamoImportRepository implements ImportRepository {
  constructor(
    private readonly client: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  async createSession(session: OnboardingSession): Promise<OnboardingSession> {
    const parsed = onboardingSessionSchema.parse(session);
    await this.client.send(new PutCommand({
      TableName: this.tableName,
      Item: this.sessionItem(parsed),
      ConditionExpression: "attribute_not_exists(PK)",
    }));
    return parsed;
  }

  async getSession(sessionId: string, companyId: string): Promise<OnboardingSession | null> {
    const result = await this.client.send(new GetCommand({
      TableName: this.tableName,
      Key: { PK: companyPk(companyId), SK: `ONBOARDING#${sessionId}` },
      ConsistentRead: true,
    }));
    return result.Item ? onboardingSessionSchema.parse(withoutKeys(result.Item)) : null;
  }

  async getActiveSession(companyId: string, actorId: string): Promise<OnboardingSession | null> {
    const result = await this.client.send(new QueryCommand({
      TableName: this.tableName,
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :pk",
      ExpressionAttributeValues: { ":pk": `ONBOARDING#${companyId}#${actorId}` },
      ScanIndexForward: false,
      Limit: 10,
    }));
    return (result.Items ?? [])
      .map((item) => onboardingSessionSchema.parse(withoutKeys(item)))
      .find((session) => !["COMPLETED", "SKIPPED"].includes(session.state)) ?? null;
  }

  async updateSession(session: OnboardingSession, expectedVersion: number): Promise<OnboardingSession> {
    const parsed = onboardingSessionSchema.parse(session);
    try {
      await this.client.send(new PutCommand({
        TableName: this.tableName,
        Item: this.sessionItem(parsed),
        ConditionExpression: "attribute_exists(PK) AND #version = :expected",
        ExpressionAttributeNames: { "#version": "version" },
        ExpressionAttributeValues: { ":expected": expectedVersion },
      }));
    } catch (error) {
      throw appError("STALE_WRITE", true, error);
    }
    return parsed;
  }

  async createBatch(batch: ImportBatch, item: ImportedItem): Promise<ImportBatch> {
    const parsedBatch = importBatchSchema.parse(batch);
    const parsedItem = importedItemSchema.parse(item);
    await this.client.send(new TransactWriteCommand({
      ClientRequestToken: createHash("sha256").update(batch.idempotencyKey).digest("hex").slice(0, 36),
      TransactItems: [
        { Put: { TableName: this.tableName, Item: this.batchItem(parsedBatch), ConditionExpression: "attribute_not_exists(PK)" } },
        { Put: { TableName: this.tableName, Item: this.itemItem(parsedItem), ConditionExpression: "attribute_not_exists(PK)" } },
      ],
    }));
    return parsedBatch;
  }

  async getBatch(batchId: string, companyId: string): Promise<ImportBatch | null> {
    const result = await this.client.send(new GetCommand({
      TableName: this.tableName,
      Key: { PK: companyPk(companyId), SK: `IMPORT#${batchId}` },
      ConsistentRead: true,
    }));
    return result.Item ? importBatchSchema.parse(withoutKeys(result.Item)) : null;
  }

  async findBatchByIdempotencyKey(companyId: string, idempotencyKey: string): Promise<ImportBatch | null> {
    const result = await this.client.send(new QueryCommand({
      TableName: this.tableName,
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :pk",
      ExpressionAttributeValues: {
        ":pk": `IMPORT_IDEMPOTENCY#${companyId}#${createHash("sha256").update(idempotencyKey).digest("hex")}`,
      },
      Limit: 1,
    }));
    const item = result.Items?.[0];
    return item ? importBatchSchema.parse(withoutKeys(item)) : null;
  }

  async updateBatch(batch: ImportBatch, expectedVersion: number): Promise<ImportBatch> {
    const parsed = importBatchSchema.parse(batch);
    try {
      await this.client.send(new PutCommand({
        TableName: this.tableName,
        Item: this.batchItem(parsed),
        ConditionExpression: "attribute_exists(PK) AND #version = :expected",
        ExpressionAttributeNames: { "#version": "version" },
        ExpressionAttributeValues: { ":expected": expectedVersion },
      }));
    } catch (error) {
      throw appError("STALE_WRITE", true, error);
    }
    return parsed;
  }

  async getItem(itemId: string, companyId: string): Promise<ImportedItem | null> {
    const result = await this.client.send(new GetCommand({
      TableName: this.tableName,
      Key: { PK: companyPk(companyId), SK: `IMPORTED_ITEM#${itemId}` },
      ConsistentRead: true,
    }));
    return result.Item ? importedItemSchema.parse(withoutKeys(result.Item)) : null;
  }

  async updateItem(item: ImportedItem): Promise<ImportedItem> {
    const parsed = importedItemSchema.parse(item);
    await this.client.send(new PutCommand({
      TableName: this.tableName,
      Item: this.itemItem(parsed),
      ConditionExpression: "attribute_exists(PK)",
    }));
    return parsed;
  }

  private sessionItem(session: OnboardingSession): Item {
    return {
      PK: companyPk(session.companyId), SK: `ONBOARDING#${session.id}`, entity: "ONBOARDING_SESSION",
      GSI1PK: `ONBOARDING#${session.companyId}#${session.createdBy}`, GSI1SK: `${session.updatedAt}#${session.id}`,
      ...session,
    };
  }

  private batchItem(batch: ImportBatch): Item {
    return {
      PK: companyPk(batch.companyId), SK: `IMPORT#${batch.id}`, entity: "IMPORT_BATCH",
      GSI1PK: `IMPORT_IDEMPOTENCY#${batch.companyId}#${createHash("sha256").update(batch.idempotencyKey).digest("hex")}`,
      GSI1SK: batch.createdAt,
      ...batch,
    };
  }

  private itemItem(item: ImportedItem): Item {
    return { PK: companyPk(item.companyId), SK: `IMPORTED_ITEM#${item.id}`, entity: "IMPORTED_ITEM", ...item };
  }
}
