import { beforeEach, describe, expect, it } from "vitest";
import { getDemoState, resetDemoState } from "@/adapters/local/demo-state";
import { employeeActor, ownerActor } from "@/server/actors";
import { assistantService, conversationService, memoryService, sopService } from "@/server/container";

describe("local salon flow", () => {
  beforeEach(() => resetDemoState());

  it("keeps a suggestion non-authoritative until owner approval, then reuses it", async () => {
    const conversation = await conversationService.create({ assistantRole: "MARKETING", title: "Tuesday promotion" }, ownerActor());
    const result = await conversationService.send(conversation.id, {
      content: "We never discount more than 15%. We prefer offering a free add-on because we want to maintain a premium image.",
      idempotencyKey: "rule-message-0001",
    }, ownerActor());
    const candidate = result.suggestedKnowledge[0];
    expect(candidate?.status).toBe("PROPOSED");
    expect((await assistantService.answerEmployee("Can I give a customer 25% off?", employeeActor())).groundingStatus).toBe("NO_APPROVED_CONTEXT");

    const memory = await memoryService.approveCandidate(candidate.id, candidate.version, ownerActor());
    expect(memory.record.indexStatus).toBe("READY");
    const answer = await assistantService.answerEmployee("Can I give a customer 25% off?", employeeActor());
    expect(answer.groundingStatus).toBe("GROUNDED");
    expect(answer.answer).toContain("15%");
    expect(answer.sourceMemories[0]?.memoryId).toBe(memory.record.id);

    const sop = await sopService.generate(ownerActor(), true);
    expect(sop.sop.sourceMemories[0]?.memoryId).toBe(memory.record.id);
    expect(sop.candidate?.status).toBe("PROPOSED");

    const operations = await conversationService.create({
      assistantRole: "OPERATIONS",
      title: "Tuesday handoff",
    }, ownerActor());
    const operationsRequest = "Create a Tuesday promotion handoff checklist for the front desk.";
    const operationsResult = await conversationService.send(operations.id, {
      content: operationsRequest,
      idempotencyKey: "operations-uses-request",
    }, ownerActor());
    expect(operationsResult.sop?.purpose).toContain(operationsRequest);
  });

  it("prevents an employee from approving company knowledge", async () => {
    const conversation = await conversationService.create({ assistantRole: "MARKETING", title: "Tuesday" }, ownerActor());
    const result = await conversationService.send(conversation.id, {
      content: "We never discount more than 15%. We prefer offering a free add-on because we want to maintain a premium image.",
      idempotencyKey: "rule-message-0002",
    }, ownerActor());
    await expect(memoryService.approveCandidate(result.suggestedKnowledge[0].id, 1, employeeActor())).rejects.toThrow("FORBIDDEN");
  });

  it("lets the owner amend approved knowledge without erasing its history", async () => {
    const conversation = await conversationService.create({ assistantRole: "MARKETING", title: "Tuesday" }, ownerActor());
    const result = await conversationService.send(conversation.id, {
      content: "We never discount more than 15%. We prefer offering a free add-on because we want to maintain a premium image.",
      idempotencyKey: "amend-playbook-rule",
    }, ownerActor());
    const approved = await memoryService.approveCandidate(result.suggestedKnowledge[0].id, 1, ownerActor());

    const amended = await memoryService.amendMemory(approved.record.id, {
      expectedMemoryVersion: 1,
      title: "Promotional discounts must not exceed 10%",
      statement: "Promotional discounts must not exceed 10%. Prefer complimentary add-ons over deeper discounts.",
      rationale: "Protect margins and maintain premium brand positioning.",
      appliesToRoles: approved.version.appliesToRoles,
      scope: approved.version.scope,
    }, ownerActor());

    expect(amended.record.currentVersion).toBe(2);
    expect(amended.record.indexStatus).toBe("READY");
    expect(amended.history.map((version) => version.version)).toEqual([2, 1]);
    expect(amended.history[0]?.sourceRefs.map((source) => source.label)).toContain("Direct Playbook edit");
    expect(amended.history[1]?.statement).toContain("15%");
    const answer = await assistantService.answerEmployee("Can I give a customer 25% off?", employeeActor());
    expect(answer.answer).toContain("10%");
    expect(answer.sourceMemories[0]?.version).toBe(2);

    await expect(memoryService.amendMemory(approved.record.id, {
      expectedMemoryVersion: 1,
      title: "Stale title",
      statement: "This stale edit must not be saved.",
      rationale: null,
      appliesToRoles: ["EMPLOYEE"],
      scope: approved.version.scope,
    }, ownerActor())).rejects.toThrow("STALE_WRITE");
  });

  it("prevents an employee from directly amending approved knowledge", async () => {
    const existing = (await memoryService.listMemories(ownerActor()))[0];
    await expect(memoryService.amendMemory(existing.record.id, {
      expectedMemoryVersion: existing.version.version,
      title: existing.version.title,
      statement: "Employees cannot make this authoritative.",
      rationale: null,
      appliesToRoles: ["EMPLOYEE"],
      scope: existing.version.scope,
    }, employeeActor())).rejects.toThrow("FORBIDDEN");
  });

  it("does not duplicate a message with the same idempotency key", async () => {
    const conversation = await conversationService.create({ assistantRole: "MARKETING", title: "Tuesday" }, ownerActor());
    const input = { content: "Tuesdays are quiet. Create a promotion.", idempotencyKey: "same-message-key" };
    await conversationService.send(conversation.id, input, ownerActor());
    const duplicate = await conversationService.send(conversation.id, input, ownerActor());
    expect(duplicate.assistantMessage).toBeNull();
    expect(await conversationService.listMessages(conversation.id, ownerActor())).toHaveLength(2);
  });

  it("rejects likely secrets before persisting a chat message or source", async () => {
    const conversation = await conversationService.create({ assistantRole: "MARKETING", title: "Private key check" }, ownerActor());
    const sourcesBefore = getDemoState().sources.length;

    await expect(conversationService.send(conversation.id, {
      content: "Please remember api_key=sk-proj-abcdefghijklmnopqrstuvwxyz123456",
      idempotencyKey: "secret-message-key",
    }, ownerActor())).rejects.toThrow("VALIDATION_ERROR");
    expect(await conversationService.listMessages(conversation.id, ownerActor())).toEqual([]);
    expect(getDemoState().sources).toHaveLength(sourcesBefore);
  });

  it("lists and reopens scoped conversations", async () => {
    const conversation = await conversationService.create({
      assistantRole: "MARKETING",
      title: "Marketing planning",
      scope: { level: "DEPARTMENT", organizationalUnitId: "unit-marketing" },
    }, ownerActor());
    await conversationService.send(conversation.id, {
      content: "Tuesdays are quiet. Create a promotion.",
      idempotencyKey: "persistent-conversation",
    }, ownerActor());

    const listed = await conversationService.list(ownerActor());
    expect(listed[0]).toMatchObject({
      id: conversation.id,
      scope: { level: "DEPARTMENT", organizationalUnitId: "unit-marketing" },
    });
    expect(await conversationService.listMessages(conversation.id, ownerActor())).toHaveLength(2);
  });

  it("lets an owner create a department knowledge page with a trusted source", async () => {
    const memory = await memoryService.createMemoryPage({
      title: "Front Desk service recovery discount",
      statement: "Front Desk may offer up to 5% off after a documented service issue.",
      rationale: "Resolve small service problems consistently.",
      type: "POLICY",
      appliesToRoles: ["FRONT_DESK", "EMPLOYEE"],
      sensitivity: "INTERNAL",
      tags: ["service-recovery"],
      scope: { level: "DEPARTMENT", organizationalUnitId: "unit-front-desk" },
      sourceMessageIds: [],
    }, ownerActor());

    expect(memory.record.scope).toEqual({ level: "DEPARTMENT", organizationalUnitId: "unit-front-desk" });
    expect(memory.record.indexStatus).toBe("READY");
    expect(memory.version.sourceRefs[0]?.label).toBe("Created directly in the Company Playbook");
  });
});
