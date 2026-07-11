import type { Company } from "@/domain/types";

export interface CompanyRepository {
  get(companyId: string): Promise<Company | null>;
  update(company: Company): Promise<Company>;
  resetDemo(): Promise<Company>;
}
