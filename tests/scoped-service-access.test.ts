import { beforeEach, describe, expect, it } from "vitest";
import { resetDemoState } from "@/adapters/local/demo-state";
import { LocalMemoryRepository } from "@/adapters/local/memory-repository";
import {
  conversationService,
  connectedSuggestionService,
  membershipService,
  memoryService,
} from "@/server/container";
import { ownerActor } from "@/server/actors";

beforeEach(() => resetDemoState());

describe("scoped service access", () => {
  it("isolates non-owner conversations and creates suggestions only with SUGGEST", async () => {
    const owner = ownerActor();
    const marketing = await membershipService.resolveActor("DEMO", "user-marketing-demo");
    const employee = await membershipService.resolveActor("DEMO", "user-employee-demo");
    await conversationService.create({ assistantRole: "MARKETING", title: "Owner private" }, owner);
    expect(await conversationService.list(marketing)).toEqual([]);

    const marketingConversation = await conversationService.create({
      assistantRole: "MARKETING",
      title: "Marketing rule",
      scope: { level: "DEPARTMENT", organizationalUnitId: "unit-marketing" },
    }, marketing);
    const suggested = await conversationService.send(marketingConversation.id, {
      content: "Never discount more than 15%. Prefer complimentary add-ons.",
      idempotencyKey: "marketing-suggestion-1",
    }, marketing);
    expect(suggested.suggestedKnowledge).toHaveLength(1);

    const employeeConversation = await conversationService.create({
      assistantRole: "MARKETING",
      title: "Read only",
      scope: { level: "DEPARTMENT", organizationalUnitId: "unit-front-desk" },
    }, employee);
    const readOnly = await conversationService.send(employeeConversation.id, {
      content: "Never discount more than 25%.",
      idempotencyKey: "read-only-1",
    }, employee);
    expect(readOnly.suggestedKnowledge).toEqual([]);
  });

  it("shows reviewers only candidates in their approval scope", async () => {
    const owner = ownerActor();
    const operations = await membershipService.resolveActor("DEMO", "user-operations-demo");
    await memoryService.createSuggestion({
      type: "SOP",
      title: "Operations opening checklist",
      statement: "Open the salon using the approved checklist.",
      rationale: "Keep opening consistent.",
      appliesToRoles: ["OPERATIONS"],
      tags: ["opening"],
      sensitivity: "INTERNAL",
      scope: { level: "DEPARTMENT", organizationalUnitId: "unit-operations" },
    }, owner);
    await memoryService.createSuggestion({
      type: "BRAND_RULE",
      title: "Marketing tone",
      statement: "Use a warm and refined voice.",
      rationale: null,
      appliesToRoles: ["MARKETING"],
      tags: ["brand"],
      sensitivity: "INTERNAL",
      scope: { level: "DEPARTMENT", organizationalUnitId: "unit-marketing" },
    }, owner);
    const visible = await memoryService.listCandidates(operations);
    expect(visible.map((candidate) => candidate.title)).toEqual(["Operations opening checklist"]);
    await expect(memoryService.approveCandidate(
      (await memoryService.listCandidates(owner)).find((candidate) => candidate.title === "Marketing tone")!.id,
      1,
      operations,
    )).rejects.toThrow("FORBIDDEN");
  });

  it("resolves an update as a new version and prevents duplicate approval", async () => {
    const owner = ownerActor();
    const existing = (await memoryService.listMemories(owner))[0];
    const repository = new LocalMemoryRepository();
    const update = await memoryService.createSuggestion({
      type: existing.record.type,
      title: "Updated company profile",
      statement: "The company profile now includes an updated operating rule.",
      rationale: "The earlier version is no longer complete.",
      appliesToRoles: existing.record.appliesToRoles,
      tags: existing.record.tags,
      sensitivity: existing.record.sensitivity,
      scope: existing.record.scope,
    }, owner);
    const classifiedUpdate = await repository.updateCandidate({
      ...update,
      version: 2,
      relation: "UPDATE",
      relatedMemoryIds: [existing.record.id],
    });
    const resolved = await memoryService.resolveCandidate(classifiedUpdate.id, {
      expectedCandidateVersion: classifiedUpdate.version,
      resolution: "UPDATE",
    }, owner);
    expect(resolved.record.id).toBe(existing.record.id);
    expect(resolved.record.currentVersion).toBe(existing.record.currentVersion + 1);
    expect((await memoryService.getMemory(existing.record.id, owner))?.history).toHaveLength(2);

    const duplicate = await memoryService.createSuggestion({
      type: "POLICY",
      title: "Repeated company rule",
      statement: "This repeats an already approved company rule.",
      rationale: null,
      appliesToRoles: ["EMPLOYEE"],
      tags: ["duplicate"],
      sensitivity: "INTERNAL",
      scope: { level: "COMPANY" },
    }, owner);
    const classifiedDuplicate = await repository.updateCandidate({
      ...duplicate,
      version: 2,
      relation: "DUPLICATE",
      relatedMemoryIds: [existing.record.id],
    });
    await expect(memoryService.approveCandidate(classifiedDuplicate.id, classifiedDuplicate.version, owner)).rejects.toThrow("CONFLICT");
  });

  it("keeps connected suggestions scoped, idempotent, and secret-screened", async () => {
    const marketing = await membershipService.resolveActor("DEMO", "user-marketing-demo");
    const input = {
      content: "We never discount more than 15%. We prefer a free add-on.",
      idempotencyKey: "connected-marketing-rule-1",
      scope: { level: "DEPARTMENT" as const, organizationalUnitId: "unit-marketing" },
    };
    const first = await connectedSuggestionService.suggest(input, marketing);
    const retry = await connectedSuggestionService.suggest(input, marketing);
    expect(first.status).toBe("PROPOSED");
    expect(retry.status).toBe("PROPOSED");
    if (first.status === "PROPOSED" && retry.status === "PROPOSED") {
      expect(retry.candidate.id).toBe(first.candidate.id);
      expect(first.candidate.sourceRefs[0]?.label).toBe("Connected assistant conversation");
    }
    await expect(connectedSuggestionService.suggest({ ...input, idempotencyKey: "connected-company-rule-2", scope: { level: "COMPANY" } }, marketing))
      .rejects.toThrow("FORBIDDEN");
    await expect(connectedSuggestionService.suggest({
      ...input,
      idempotencyKey: "connected-secret-rule-3",
      content: "The api_key = sk_abcdefghijklmnopqrstuvwxyz0123456789 should be remembered.",
    }, marketing)).rejects.toThrow("VALIDATION_ERROR");
  });

  it("ignores forged company identity fields in suggestion input", async () => {
    const owner = ownerActor();
    const candidate = await memoryService.createSuggestion({
      companyId: "other-company",
      createdBy: "forged-user",
      type: "POLICY",
      title: "Server scoped policy",
      statement: "Use the server actor company.",
      rationale: null,
      appliesToRoles: ["EMPLOYEE"],
      tags: [],
      sensitivity: "INTERNAL",
      scope: { level: "COMPANY" },
    }, owner);
    expect(candidate.companyId).toBe(owner.companyId);
    expect(candidate.createdBy).toBe(owner.userId);
  });
});
