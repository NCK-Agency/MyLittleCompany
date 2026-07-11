import { appError } from "@/domain/errors";
import { isOwner } from "@/domain/authorization";
import type { ActorContext, Company } from "@/domain/types";
import type { CompanyRepository } from "@/ports/company-repository";
import { z } from "zod";

const updateCompanySchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().min(10).max(1000),
});

export class CompanyService {
  constructor(private readonly companies: CompanyRepository) {}

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

  async resetDemo(actor: ActorContext): Promise<Company> {
    if (!isOwner(actor)) throw appError("FORBIDDEN");
    return this.companies.resetDemo();
  }
}
