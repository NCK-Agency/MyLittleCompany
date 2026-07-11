import type { CompanyMembership, IdentityProvider } from "@/domain/types";

export interface MembershipRepository {
  listMemberships(companyId: string): Promise<CompanyMembership[]>;
  getMembership(companyId: string, userId: string): Promise<CompanyMembership | null>;
  getMembershipByEmail(companyId: string, email: string): Promise<CompanyMembership | null>;
  findMembershipByIdentity(provider: IdentityProvider, subject: string): Promise<CompanyMembership | null>;
  createMembership(membership: CompanyMembership): Promise<CompanyMembership>;
  updateMembership(membership: CompanyMembership): Promise<CompanyMembership>;
}
