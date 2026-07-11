import { appError } from "@/domain/errors";
import { isOwner } from "@/domain/authorization";
import { updateAssistantSettingsSchema } from "@/domain/schemas";
import type { ActorContext, AssistantModelTier, Company } from "@/domain/types";
import type { CompanyRepository } from "@/ports/company-repository";
import { z } from "zod";

const updateCompanySchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().min(10).max(1000),
});

export class CompanyService {
  constructor(
    private readonly companies: CompanyRepository,
    private readonly demoCompanyId: string,
  ) {}

  async get(actor: ActorContext): Promise<Company> {
    const company = await this.companies.get(actor.companyId);
    if (!company) throw appError("NOT_FOUND");
    return company;
  }

  async update(input: unknown, actor: ActorContext): Promise<Company> {
    if (!isOwner(actor)) throw appError("FORBIDDEN");
    const values = updateCompanySchema.parse(input);
    const company = await this.get(actor);
    return this.companies.update({ ...company, ...values, updatedAt: new Date().toISOString() });
  }

  async getAssistantModelTier(actor: ActorContext): Promise<AssistantModelTier> {
    if (!isOwner(actor)) throw appError("FORBIDDEN");
    return (await this.get(actor)).assistantModelTier;
  }

  async updateAssistantModelTier(input: unknown, actor: ActorContext): Promise<AssistantModelTier> {
    if (!isOwner(actor)) throw appError("FORBIDDEN");
    const { modelTier } = updateAssistantSettingsSchema.parse(input);
    const company = await this.get(actor);
    const updated = await this.companies.update({
      ...company,
      assistantModelTier: modelTier,
      updatedAt: new Date().toISOString(),
    });
    return updated.assistantModelTier;
  }

  async resetDemo(actor: ActorContext): Promise<Company> {
    if (!isOwner(actor) || actor.companyId !== this.demoCompanyId) throw appError("FORBIDDEN");
    return this.companies.resetDemo(actor.companyId);
  }
}
