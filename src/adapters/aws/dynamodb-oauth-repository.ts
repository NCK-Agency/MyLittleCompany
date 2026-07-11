import { DeleteCommand, GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { OAuthAuthorizationCode, OAuthClient, OAuthRefreshGrant } from "@/oauth/types";
import type { OAuthRepository } from "@/ports/oauth-repository";

export class DynamoOAuthRepository implements OAuthRepository {
  constructor(private readonly client: DynamoDBDocumentClient, private readonly tableName: string) {}

  async createClient(client: OAuthClient): Promise<void> {
    await this.client.send(new PutCommand({
      TableName: this.tableName,
      Item: { PK: `OAUTH_CLIENT#${client.clientId}`, SK: "PROFILE", entityType: "OAUTH_CLIENT", ...client },
      ConditionExpression: "attribute_not_exists(PK)",
    }));
  }

  async getClient(clientId: string): Promise<OAuthClient | null> {
    const result = await this.client.send(new GetCommand({
      TableName: this.tableName,
      Key: { PK: `OAUTH_CLIENT#${clientId}`, SK: "PROFILE" },
    }));
    return result.Item ? this.clientFromItem(result.Item) : null;
  }

  async createAuthorizationCode(code: OAuthAuthorizationCode): Promise<void> {
    await this.client.send(new PutCommand({
      TableName: this.tableName,
      Item: {
        PK: `OAUTH_CODE#${code.codeHash}`,
        SK: "CODE",
        entityType: "OAUTH_CODE",
        ttl: Math.floor(new Date(code.expiresAt).getTime() / 1000),
        ...code,
      },
    }));
  }

  async consumeAuthorizationCode(codeHash: string): Promise<OAuthAuthorizationCode | null> {
    const key = { PK: `OAUTH_CODE#${codeHash}`, SK: "CODE" };
    const result = await this.client.send(new GetCommand({ TableName: this.tableName, Key: key, ConsistentRead: true }));
    if (!result.Item) return null;
    await this.client.send(new DeleteCommand({
      TableName: this.tableName,
      Key: key,
      ConditionExpression: "codeHash = :codeHash",
      ExpressionAttributeValues: { ":codeHash": codeHash },
    }));
    return this.codeFromItem(result.Item);
  }

  async createRefreshGrant(grant: OAuthRefreshGrant): Promise<void> {
    await this.client.send(new PutCommand({
      TableName: this.tableName,
      Item: {
        PK: `OAUTH_REFRESH#${grant.tokenHash}`,
        SK: "GRANT",
        GSI1PK: `OAUTH_FAMILY#${grant.familyId}`,
        GSI1SK: grant.createdAt,
        entityType: "OAUTH_REFRESH",
        ttl: Math.floor(new Date(grant.expiresAt).getTime() / 1000),
        ...grant,
      },
    }));
  }

  async consumeRefreshGrant(tokenHash: string): Promise<OAuthRefreshGrant | null> {
    const key = { PK: `OAUTH_REFRESH#${tokenHash}`, SK: "GRANT" };
    const result = await this.client.send(new GetCommand({ TableName: this.tableName, Key: key, ConsistentRead: true }));
    if (!result.Item) return null;
    await this.client.send(new DeleteCommand({
      TableName: this.tableName,
      Key: key,
      ConditionExpression: "tokenHash = :tokenHash",
      ExpressionAttributeValues: { ":tokenHash": tokenHash },
    }));
    return this.refreshFromItem(result.Item);
  }

  async revokeRefreshGrant(tokenHash: string): Promise<void> {
    await this.client.send(new DeleteCommand({
      TableName: this.tableName,
      Key: { PK: `OAUTH_REFRESH#${tokenHash}`, SK: "GRANT" },
    }));
  }

  async revokeRefreshFamily(familyId: string): Promise<void> {
    const result = await this.client.send(new QueryCommand({
      TableName: this.tableName,
      IndexName: "GSI1",
      KeyConditionExpression: "GSI1PK = :pk",
      ExpressionAttributeValues: { ":pk": `OAUTH_FAMILY#${familyId}` },
    }));
    await Promise.all((result.Items ?? []).map((item) => this.revokeRefreshGrant(String(item.tokenHash))));
  }

  private clientFromItem(item: Record<string, unknown>): OAuthClient {
    return {
      clientId: String(item.clientId),
      clientName: String(item.clientName),
      redirectUris: item.redirectUris as string[],
      createdAt: String(item.createdAt),
    };
  }

  private codeFromItem(item: Record<string, unknown>): OAuthAuthorizationCode {
    return item as unknown as OAuthAuthorizationCode;
  }

  private refreshFromItem(item: Record<string, unknown>): OAuthRefreshGrant {
    return item as unknown as OAuthRefreshGrant;
  }
}
