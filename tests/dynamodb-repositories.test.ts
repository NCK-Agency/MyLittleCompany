import { describe, expect, it, vi } from "vitest";
import { DynamoRepositories } from "@/adapters/aws/dynamodb-repositories";
import type { MemoryCandidate, Message } from "@/domain/types";

const candidate: MemoryCandidate = {
  id: "candidate-1", version: 1, companyId: "company-a", conversationId: "conversation-1",
  scope: { level: "COMPANY" },
  type: "DECISION", title: "Discount cap", statement: "Discounts cannot exceed 15%.",
  rationale: "Protect margins.", rationaleMissing: false, appliesToRoles: ["EMPLOYEE"],
  tags: ["pricing"], sensitivity: "INTERNAL", sourceRefs: [{ sourceId: "source", label: "Owner" }],
  confidence: 0.99, relation: "UNRELATED", relatedMemoryIds: [], status: "PROPOSED",
  extractionPromptVersion: "1.0.0", modelId: "model", createdBy: "owner",
  createdAt: "2026-07-11T00:00:00.000Z",
};

describe("DynamoRepositories approval", () => {
  it("creates candidate result, record, immutable version, and audits in one conditional transaction", async () => {
    const send = vi.fn((command: { constructor: { name: string }; input: Record<string, unknown> }) => {
      if (command.constructor.name === "GetCommand") {
        return Promise.resolve({ Item: {
          PK: "COMPANY#company-a", SK: "CANDIDATE#candidate-1", entity: "CANDIDATE", ...candidate,
        } });
      }
      return Promise.resolve({});
    });
    const repository = new DynamoRepositories({ send } as never, "table");
    const result = await repository.approveCandidate({
      companyId: "company-a", candidateId: "candidate-1", expectedCandidateVersion: 1,
      actorId: "owner", approvedAt: "2026-07-11T01:00:00.000Z", memoryId: "memory-1",
      idempotencyKey: "company-a:candidate-1:v1",
    });
    expect(result).toMatchObject({ created: true, memory: { record: { id: "memory-1", indexStatus: "PENDING" } } });
    const transaction = send.mock.calls.find(([command]) => command.constructor.name === "TransactWriteCommand")?.[0];
    const items = transaction?.input.TransactItems as Array<{ Put: Record<string, unknown> }>;
    expect(items).toHaveLength(5);
    expect(items[0]?.Put.ConditionExpression).toBe("#status = :proposed AND #version = :version");
    expect(items[2]?.Put.ConditionExpression).toBe("attribute_not_exists(PK)");
    expect(items[2]?.Put.Item).toMatchObject({ PK: "COMPANY#company-a#MEMORY#memory-1" });
  });

  it("creates a new immutable version and advances the current record atomically", async () => {
    const current = {
      record: {
        id: "memory-1", companyId: "company-a", type: "DECISION", status: "APPROVED",
        currentVersion: 1, title: "Discount cap", scope: { level: "COMPANY" }, appliesToRoles: ["EMPLOYEE"], sensitivity: "INTERNAL",
        tags: ["pricing"], effectiveFrom: "2026-07-11T00:00:00.000Z", createdAt: "2026-07-11T00:00:00.000Z",
        updatedAt: "2026-07-11T00:00:00.000Z", indexStatus: "READY",
      },
      version: {
        memoryId: "memory-1", companyId: "company-a", version: 1, title: "Discount cap", scope: { level: "COMPANY" },
        statement: "Discounts cannot exceed 15%.", rationale: "Protect margins.", appliesToRoles: ["EMPLOYEE"],
        sensitivity: "INTERNAL", tags: ["pricing"], effectiveFrom: "2026-07-11T00:00:00.000Z",
        sourceRefs: [{ sourceId: "source", label: "Owner" }], approvedBy: "owner",
        approvedAt: "2026-07-11T00:00:00.000Z", createdAt: "2026-07-11T00:00:00.000Z",
      },
    };
    const send = vi.fn((command: { constructor: { name: string }; input: Record<string, unknown> }) => {
      if (command.constructor.name !== "GetCommand") return Promise.resolve({});
      const key = command.input.Key as { PK: string; SK: string };
      if (key.PK === "COMPANY#company-a") return Promise.resolve({ Item: { PK: key.PK, SK: key.SK, entity: "MEMORY", ...current.record } });
      return Promise.resolve({ Item: { PK: key.PK, SK: key.SK, entity: "MEMORY_VERSION", ...current.version } });
    });
    const repository = new DynamoRepositories({ send } as never, "table");
    const result = await repository.createVersion({
      companyId: "company-a", memoryId: "memory-1", expectedMemoryVersion: 1,
      title: "Discount cap", statement: "Discounts cannot exceed 10%.", rationale: "Protect margins.",
      scope: { level: "COMPANY" },
      appliesToRoles: ["EMPLOYEE"], tags: ["pricing"], sensitivity: "INTERNAL",
      sourceRefs: [{ sourceId: "manual", label: "Direct Playbook edit" }], actorId: "owner",
      approvedAt: "2026-07-11T01:00:00.000Z",
    });

    expect(result).toMatchObject({ record: { currentVersion: 2, indexStatus: "PENDING" }, version: { version: 2 } });
    const transaction = send.mock.calls.find(([command]) => command.constructor.name === "TransactWriteCommand")?.[0];
    const items = transaction?.input.TransactItems as Array<{ Put: Record<string, unknown> }>;
    expect(items).toHaveLength(3);
    expect(items[0]?.Put.ConditionExpression).toBe("#status = :approved AND currentVersion = :expected");
    expect(items[1]?.Put.ConditionExpression).toBe("attribute_not_exists(PK)");
    expect(items[1]?.Put.Item).toMatchObject({ PK: "COMPANY#company-a#MEMORY#memory-1" });
  });
});

describe("DynamoRepositories company partition isolation", () => {
  it("reads conversation messages consistently for immediate retry replay", async () => {
    const send = vi.fn((command: { constructor: { name: string } }) => {
      if (command.constructor.name === "GetCommand") {
        return Promise.resolve({ Item: {
          PK: "COMPANY#company-a",
          SK: "CONVERSATION#conversation-1",
          entity: "CONVERSATION",
          id: "conversation-1",
          companyId: "company-a",
          title: "Retry replay",
          assistantRole: "OPERATIONS",
          scope: { level: "COMPANY" },
          createdBy: "owner",
          createdAt: "2026-07-11T00:00:00.000Z",
          updatedAt: "2026-07-11T00:00:00.000Z",
        } });
      }
      return Promise.resolve({ Items: [] });
    });
    const repository = new DynamoRepositories({ send } as never, "table");

    await repository.listMessages("conversation-1", "company-a");

    const query = send.mock.calls.find(([command]) => command.constructor.name === "QueryCommand")?.[0] as unknown as {
      input: Record<string, unknown>;
    };
    expect(query.input).toMatchObject({
      ConsistentRead: true,
      ExpressionAttributeValues: {
        ":pk": "COMPANY#company-a#CONVERSATION#conversation-1",
        ":prefix": "MESSAGE#",
      },
    });
  });

  it("namespaces identical conversation and message IDs by company", async () => {
    const send = vi.fn().mockResolvedValue({});
    const repository = new DynamoRepositories({ send } as never, "table");
    const base: Omit<Message, "companyId"> = {
      id: "message-1",
      conversationId: "conversation-1",
      actorType: "USER",
      actorId: "owner",
      content: "Hello",
      sourceRefs: [],
      createdAt: "2026-07-11T00:00:00.000Z",
    };

    await repository.appendMessage({ ...base, companyId: "company-a" });
    await repository.appendMessage({ ...base, companyId: "company-b" });

    const puts = send.mock.calls
      .map(([command]) => command)
      .filter((command) => command.constructor.name === "PutCommand");
    expect(puts.map((command) => (command.input.Item as { PK: string }).PK)).toEqual([
      "COMPANY#company-a#CONVERSATION#conversation-1",
      "COMPANY#company-b#CONVERSATION#conversation-1",
    ]);
  });

  it("namespaces identical memory and version IDs by company", async () => {
    const send = vi.fn((command: { constructor: { name: string }; input: Record<string, unknown> }) => {
      if (command.constructor.name !== "GetCommand") return Promise.resolve({});
      const key = command.input.Key as { PK: string };
      const companyId = key.PK.startsWith("COMPANY#company-b") ? "company-b" : "company-a";
      return Promise.resolve({ Item: {
        PK: `COMPANY#${companyId}`,
        SK: "CANDIDATE#candidate-1",
        entity: "CANDIDATE",
        ...candidate,
        companyId,
      } });
    });
    const repository = new DynamoRepositories({ send } as never, "table");

    for (const companyId of ["company-a", "company-b"]) {
      await repository.approveCandidate({
        companyId,
        candidateId: "candidate-1",
        expectedCandidateVersion: 1,
        actorId: "owner",
        approvedAt: "2026-07-11T01:00:00.000Z",
        memoryId: "memory-1",
        idempotencyKey: `${companyId}:candidate-1:v1`,
      });
    }

    const versionPks = send.mock.calls
      .map(([command]) => command)
      .filter((command) => command.constructor.name === "TransactWriteCommand")
      .map((command) => {
        const items = command.input.TransactItems as Array<{ Put: { Item: { entity?: string; PK: string } } }>;
        return items.find((item) => item.Put.Item.entity === "MEMORY_VERSION")?.Put.Item.PK;
      });
    expect(versionPks).toEqual([
      "COMPANY#company-a#MEMORY#memory-1",
      "COMPANY#company-b#MEMORY#memory-1",
    ]);
  });

  it("resets tenant-prefixed child partitions without scanning the table", async () => {
    const send = vi.fn((command: { constructor: { name: string }; input: Record<string, unknown> }) => {
      if (command.constructor.name !== "QueryCommand") return Promise.resolve({});
      const values = command.input.ExpressionAttributeValues as { ":pk": string };
      if (values[":pk"] === "COMPANY#demo-salon") {
        return Promise.resolve({ Items: [
          { PK: "COMPANY#demo-salon", SK: "CONVERSATION#conversation-1" },
          { PK: "COMPANY#demo-salon", SK: "MEMORY#memory-1" },
          { PK: "COMPANY#demo-salon", SK: "MEMBER#owner" },
        ] });
      }
      return Promise.resolve({ Items: [{ PK: values[":pk"], SK: "CHILD#1" }] });
    });
    const repository = new DynamoRepositories({ send } as never, "table");

    await repository.resetDemo("demo-salon");

    const queries = send.mock.calls
      .map(([command]) => command)
      .filter((command) => command.constructor.name === "QueryCommand");
    expect(queries.map((command) => (
      command.input.ExpressionAttributeValues as { ":pk": string }
    )[":pk"])).toEqual([
      "COMPANY#demo-salon",
      "COMPANY#demo-salon#CONVERSATION#conversation-1",
      "COMPANY#demo-salon#MEMORY#memory-1",
    ]);
    expect(send.mock.calls.some(([command]) => command.constructor.name === "ScanCommand")).toBe(false);
  });
});

describe("DynamoRepositories memberships", () => {
  it("indexes memberships by trusted identity subject", async () => {
    const send = vi.fn((command: { constructor: { name: string }; input: Record<string, unknown> }) => {
      if (command.constructor.name === "QueryCommand") return Promise.resolve({ Items: [{
        PK: "COMPANY#company-a", SK: "MEMBER#user-1", entity: "MEMBERSHIP",
        GSI1PK: "IDENTITY#COGNITO#subject-1", GSI1SK: "COMPANY#company-a",
        companyId: "company-a", userId: "user-1", email: "person@example.com",
        displayName: "Person", identityProvider: "COGNITO", identitySubject: "subject-1",
        roles: ["EMPLOYEE"], grants: [{ permission: "READ", scope: { level: "COMPANY" } }],
        status: "ACTIVE", createdAt: "2026-07-11T00:00:00.000Z", updatedAt: "2026-07-11T00:00:00.000Z",
      }] });
      return Promise.resolve({});
    });
    const repository = new DynamoRepositories({ send } as never, "table");
    await expect(repository.findMembershipByIdentity("COGNITO", "subject-1"))
      .resolves.toMatchObject({ companyId: "company-a", userId: "user-1" });
    const query = send.mock.calls[0]?.[0];
    expect(query?.input).toMatchObject({
      IndexName: "GSI1",
      ExpressionAttributeValues: { ":pk": "IDENTITY#COGNITO#subject-1" },
    });
  });
});
