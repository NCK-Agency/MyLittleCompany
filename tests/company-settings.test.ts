import { beforeEach, describe, expect, it, vi } from "vitest";
import { DynamoRepositories } from "@/adapters/aws/dynamodb-repositories";
import { LocalCompanyRepository } from "@/adapters/local/company-repository";
import { getDemoState, resetDemoState } from "@/adapters/local/demo-state";
import { companySchema } from "@/domain/schemas";
import { employeeActor, ownerActor } from "@/server/actors";
import { CompanyService } from "@/services/company-service";

beforeEach(() => resetDemoState());

describe("company assistant settings", () => {
  it("defaults legacy company profiles to Balanced", () => {
    const legacy = { ...getDemoState().company } as Record<string, unknown>;
    delete legacy.assistantModelTier;

    expect(companySchema.parse(legacy).assistantModelTier).toBe("BALANCED");
  });

  it("lets only the company owner read or update the tier", async () => {
    const repository = new LocalCompanyRepository();
    const service = new CompanyService(repository, "demo-salon");

    await expect(service.getAssistantModelTier(employeeActor())).rejects.toThrow("FORBIDDEN");
    await expect(service.updateAssistantModelTier({ modelTier: "FAST" }, employeeActor()))
      .rejects.toThrow("FORBIDDEN");

    await expect(service.getAssistantModelTier(ownerActor())).resolves.toBe("BALANCED");
    await expect(service.updateAssistantModelTier({ modelTier: "BEST" }, ownerActor()))
      .resolves.toBe("BEST");
    await expect(repository.get("demo-salon")).resolves.toMatchObject({ assistantModelTier: "BEST" });
  });

  it("accepts only a provider-neutral tier and ignores no client tenant identity", async () => {
    const service = new CompanyService(new LocalCompanyRepository(), "demo-salon");
    const owner = ownerActor();

    await expect(service.updateAssistantModelTier({ modelTier: "gpt-5" }, owner))
      .rejects.toThrow();
    await expect(service.updateAssistantModelTier({ modelTier: "FAST", modelId: "arbitrary-model" }, owner))
      .rejects.toThrow();
    await expect(service.updateAssistantModelTier({ modelTier: "FAST", companyId: "other-company" }, owner))
      .rejects.toThrow();
    await expect(service.updateAssistantModelTier({ modelTier: "FAST" }, { ...owner, companyId: "other-company" }))
      .rejects.toThrow("NOT_FOUND");
  });

  it("returns the demo company to Balanced after reset", async () => {
    const service = new CompanyService(new LocalCompanyRepository(), "demo-salon");
    const owner = ownerActor();

    await service.updateAssistantModelTier({ modelTier: "BEST" }, owner);
    await service.resetDemo(owner);

    await expect(service.getAssistantModelTier(owner)).resolves.toBe("BALANCED");
  });

  it("reads legacy DynamoDB profiles as Balanced and persists the selected tier", async () => {
    const legacyCompany = {
      id: "company-a",
      name: "Company A",
      description: "A complete company description.",
      productsOrServices: [],
      primaryCustomers: [],
      differentiators: [],
      brandVoice: [],
      organizationalUnits: [],
      timezone: "UTC",
      createdAt: "2026-07-11T00:00:00.000Z",
      updatedAt: "2026-07-11T00:00:00.000Z",
    };
    const send = vi.fn((command: { constructor: { name: string } }) => {
      if (command.constructor.name === "GetCommand") {
        return Promise.resolve({ Item: { PK: "COMPANY#company-a", SK: "PROFILE", entity: "COMPANY", ...legacyCompany } });
      }
      return Promise.resolve({});
    });
    const repository = new DynamoRepositories({ send } as never, "table");
    const company = await repository.get("company-a");
    expect(company?.assistantModelTier).toBe("BALANCED");

    await repository.update({ ...company!, assistantModelTier: "FAST" });
    const put = send.mock.calls.find(([command]) => command.constructor.name === "PutCommand")?.[0] as unknown as {
      input: { Item: Record<string, unknown> };
    };
    expect(put.input.Item).toMatchObject({
      PK: "COMPANY#company-a",
      SK: "PROFILE",
      assistantModelTier: "FAST",
    });
  });
});
