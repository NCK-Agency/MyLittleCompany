import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { describe, expect, it, vi } from "vitest";
import { DynamoWaitlistRepository } from "@/adapters/aws/dynamodb-waitlist-repository";
import type { WaitlistEntry } from "@/domain/types";
import type { WaitlistRepository } from "@/ports/waitlist-repository";
import { WaitlistService } from "@/services/waitlist-service";

class TestWaitlistRepository implements WaitlistRepository {
  readonly entries: WaitlistEntry[] = [];

  async upsertByEmail(entry: WaitlistEntry): Promise<WaitlistEntry> {
    const existing = this.entries.find((item) => item.email === entry.email);
    if (existing) return existing;
    this.entries.push(entry);
    return entry;
  }
}

describe("WaitlistService", () => {
  it("normalizes and stores one idempotent entry per email", async () => {
    const repository = new TestWaitlistRepository();
    const service = new WaitlistService(repository);

    await service.join({ email: " Owner@Example.com ", displayName: " Maya ", companyName: " Lotus Glow " });
    await service.join({ email: "owner@example.com" });

    expect(repository.entries).toHaveLength(1);
    expect(repository.entries[0]).toMatchObject({
      email: "owner@example.com",
      displayName: "Maya",
      companyName: "Lotus Glow",
      status: "WAITING",
      source: "PUBLIC_SITE",
    });
  });

  it("rejects invalid email and silently accepts the bot-trap field without storing", async () => {
    const repository = new TestWaitlistRepository();
    const service = new WaitlistService(repository);

    await expect(service.join({ email: "not-an-email" })).rejects.toThrow();
    await expect(service.join({ email: "bot@example.com", website: "https://spam.example" }))
      .resolves.toMatchObject({ status: "JOINED" });
    expect(repository.entries).toEqual([]);
  });
});

describe("DynamoWaitlistRepository", () => {
  const entry: WaitlistEntry = {
    id: "d2ca95bc-10fa-4577-9705-d7424ebba33e",
    email: "owner@example.com",
    status: "WAITING",
    source: "PUBLIC_SITE",
    createdAt: "2026-07-11T00:00:00.000Z",
    updatedAt: "2026-07-11T00:00:00.000Z",
  };

  it("writes a conditionally unique hashed email key", async () => {
    const send = vi.fn().mockResolvedValue({});
    const repository = new DynamoWaitlistRepository({ send } as never, "table");

    await expect(repository.upsertByEmail(entry)).resolves.toEqual(entry);
    const command = send.mock.calls[0]?.[0] as { input: Record<string, unknown> };
    expect(command.input).toMatchObject({
      TableName: "table",
      ConditionExpression: "attribute_not_exists(PK)",
    });
    expect(command.input.Item).toMatchObject({
      PK: expect.stringMatching(/^WAITLIST#[a-f0-9]{64}$/),
      SK: "ENTRY",
      entityType: "WAITLIST",
      email: "owner@example.com",
    });
  });

  it("returns the existing record when a duplicate races the conditional write", async () => {
    const send = vi.fn()
      .mockRejectedValueOnce(new ConditionalCheckFailedException({ message: "duplicate", $metadata: {} }))
      .mockResolvedValueOnce({ Item: { PK: "ignored", SK: "ENTRY", entityType: "WAITLIST", ...entry } });
    const repository = new DynamoWaitlistRepository({ send } as never, "table");

    await expect(repository.upsertByEmail(entry)).resolves.toEqual(entry);
    expect(send).toHaveBeenCalledTimes(2);
  });
});
