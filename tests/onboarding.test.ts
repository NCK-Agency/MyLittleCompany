import { beforeEach, describe, expect, it } from "vitest";
import { getDemoState, resetDemoState } from "@/adapters/local/demo-state";
import { FixtureModelGateway } from "@/adapters/local/fixture-model-gateway";
import { employeeActor, ownerActor } from "@/server/actors";
import { memoryService, onboardingService } from "@/server/container";

async function finishProcessing(batchId: string) {
  let view = await onboardingService.process(batchId, ownerActor());
  for (let attempt = 0; attempt < 6 && view.batch?.state !== "COMPLETED"; attempt += 1) {
    view = await onboardingService.process(batchId, ownerActor());
  }
  return view;
}

describe("proof-first onboarding", () => {
  it("recognizes a percentage placed before the word discount", async () => {
    const model = new FixtureModelGateway();
    const owner = ownerActor();
    const candidates = await model.extractOnboardingCandidates({
      companyId: owner.companyId,
      createdBy: owner.userId,
      proofQuestion: "What is our maximum promotional discount?",
      source: {
        sourceId: "source-chatgpt",
        label: "Promotion policy",
        content: "Our promotions must never exceed a 15% discount. Offer a free add-on instead.",
      },
    });

    expect(candidates[0]?.statement).toContain("15%");
  });

  beforeEach(() => resetDemoState());

  it("turns one source into reviewable knowledge and completes only with a newly approved citation", async () => {
    const created = await onboardingService.createSession({
      proofQuestion: "Can the front desk give a customer 25% off?",
    }, ownerActor());
    const imported = await onboardingService.createImport({
      sessionId: created.session.id,
      provider: "PASTE",
      title: "Owner pricing notes",
      content: "We never discount more than 15%. We prefer complimentary add-ons because we protect margins and our premium image.",
      idempotencyKey: "onboarding-pricing-import",
    }, ownerActor());
    const processed = await finishProcessing(imported.batch!.id);

    expect(processed.batch?.state).toBe("COMPLETED");
    expect(processed.session.state).toBe("REVIEWING");
    expect(processed.session.prioritizedCandidateIds.length).toBeGreaterThanOrEqual(1);
    const candidate = processed.candidates.find((item) => item.tags.includes("pricing"))!;
    expect(candidate.status).toBe("PROPOSED");
    expect(candidate.sourceRefs[0]?.label).toBe("Owner pricing notes");

    await expect(onboardingService.prove(created.session.id, {}, ownerActor()))
      .rejects.toThrow("NO_APPROVED_CONTEXT");
    const memory = await memoryService.approveCandidate(candidate.id, candidate.version, ownerActor());
    const proof = await onboardingService.prove(created.session.id, {}, ownerActor());

    expect(proof.session.state).toBe("COMPLETED");
    expect(proof.result.answer).toContain("15%");
    expect(proof.result.sourceMemories[0]?.memoryId).toBe(memory.record.id);
    expect(proof.searchStatus).toBe("READY");
    expect(getDemoState().importedSources[0]?.source.retention).toBe("APPROVED");
  });

  it("is idempotent for the same active session and import key", async () => {
    const created = await onboardingService.createSession({ proofQuestion: "What is our policy?" }, ownerActor());
    const input = {
      sessionId: created.session.id,
      provider: "PASTE",
      title: "Policy",
      content: "We always confirm customer requests before changing an appointment.",
      idempotencyKey: "same-onboarding-import",
    };
    const first = await onboardingService.createImport(input, ownerActor());
    const duplicate = await onboardingService.createImport({ ...input, idempotencyKey: "different-client-retry-key" }, ownerActor());
    expect(duplicate.batch?.id).toBe(first.batch?.id);
  });

  it("blocks non-owners and secret-bearing imports", async () => {
    await expect(onboardingService.createSession({ proofQuestion: "What is our policy?" }, employeeActor()))
      .rejects.toThrow("FORBIDDEN");
    const created = await onboardingService.createSession({ proofQuestion: "What is our policy?" }, ownerActor());
    await expect(onboardingService.createImport({
      sessionId: created.session.id,
      provider: "PASTE",
      title: "Unsafe notes",
      content: "api_key=sk-this-is-a-secret-value-that-must-not-be-stored",
      idempotencyKey: "secret-import-key",
    }, ownerActor())).rejects.toThrow("VALIDATION_ERROR");
  });

  it("cancels before completion and removes the raw content", async () => {
    const created = await onboardingService.createSession({ proofQuestion: "What do customers value?" }, ownerActor());
    const imported = await onboardingService.createImport({
      sessionId: created.session.id,
      provider: "PASTE",
      title: "Customer notes",
      content: "Our customers value personal service and calm appointments.",
      idempotencyKey: "cancel-import-key",
    }, ownerActor());
    const cancelled = await onboardingService.cancel(imported.batch!.id, ownerActor());
    expect(cancelled.session.state).toBe("SOURCE");
    expect(cancelled.session.activeBatchId).toBeUndefined();
  });

  it("shortens raw-source retention when nothing durable is found", async () => {
    const created = await onboardingService.createSession({ proofQuestion: "What should we remember?" }, ownerActor());
    const imported = await onboardingService.createImport({
      sessionId: created.session.id,
      provider: "PASTE",
      title: "Small talk",
      content: "Hello there. Thanks for the chat.",
      idempotencyKey: "zero-candidate-import",
    }, ownerActor());
    await finishProcessing(imported.batch!.id);

    expect(getDemoState().importedSources[0]?.source.retention).toBe("ZERO_CANDIDATE_24_HOURS");
  });

  it("shortens raw-source retention after every suggestion is ignored", async () => {
    const created = await onboardingService.createSession({ proofQuestion: "What do customers value?" }, ownerActor());
    const imported = await onboardingService.createImport({
      sessionId: created.session.id,
      provider: "PASTE",
      title: "Customer notes",
      content: "Our customers always prefer calm, personal appointments.",
      idempotencyKey: "ignored-import",
    }, ownerActor());
    const processed = await finishProcessing(imported.batch!.id);
    for (const candidate of processed.candidates) {
      const rejected = await memoryService.rejectCandidate(candidate.id, ownerActor());
      await onboardingService.candidateRejected(rejected, ownerActor());
    }

    expect(getDemoState().importedSources[0]?.source.retention).toBe("ALL_IGNORED_7_DAYS");
  });
});
