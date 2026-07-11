import type { Company } from "@/domain/types";
import type { CompanyRepository } from "@/ports/company-repository";
import { getDemoState, resetDemoState, saveDemoState } from "./demo-state";

export class LocalCompanyRepository implements CompanyRepository {
  async get(companyId: string): Promise<Company | null> {
    const company = getDemoState().company;
    return company.id === companyId ? company : null;
  }

  async update(company: Company): Promise<Company> {
    const state = getDemoState();
    if (state.company.id !== company.id) return Promise.reject(new Error("NOT_FOUND"));
    state.company = company;
    saveDemoState(state);
    return company;
  }

  async resetDemo(companyId: string): Promise<Company> {
    if (getDemoState().company.id !== companyId) throw new Error("FORBIDDEN");
    return resetDemoState().company;
  }
}
