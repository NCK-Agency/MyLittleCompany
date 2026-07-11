import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { createHash } from "node:crypto";
import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { waitlistEntrySchema } from "@/domain/schemas";
import type { WaitlistEntry } from "@/domain/types";
import type { WaitlistRepository } from "@/ports/waitlist-repository";

function waitlistKey(email: string): { PK: string; SK: string } {
  const hash = createHash("sha256").update(email).digest("hex");
  return { PK: `WAITLIST#${hash}`, SK: "ENTRY" };
}

function fromItem(item: Record<string, unknown>): WaitlistEntry {
  const value = { ...item };
  delete value.PK;
  delete value.SK;
  delete value.entityType;
  return waitlistEntrySchema.parse(value);
}

export class DynamoWaitlistRepository implements WaitlistRepository {
  constructor(
    private readonly client: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  async upsertByEmail(entry: WaitlistEntry): Promise<WaitlistEntry> {
    const parsed = waitlistEntrySchema.parse(entry);
    const key = waitlistKey(parsed.email);
    try {
      await this.client.send(new PutCommand({
        TableName: this.tableName,
        Item: { ...key, entityType: "WAITLIST", ...parsed },
        ConditionExpression: "attribute_not_exists(PK)",
      }));
      return parsed;
    } catch (error) {
      if (!(error instanceof ConditionalCheckFailedException)) throw error;
      const result = await this.client.send(new GetCommand({
        TableName: this.tableName,
        Key: key,
        ConsistentRead: true,
      }));
      if (!result.Item) throw error;
      return fromItem(result.Item);
    }
  }
}
