import { appError } from "@/domain/errors";
import type { CompanyMembership, IdentityProvider } from "@/domain/types";
import type { MembershipRepository } from "@/ports/membership-repository";
import { getDemoState, saveDemoState } from "./demo-state";

export class LocalMembershipRepository implements MembershipRepository {
  async listMemberships(companyId: string): Promise<CompanyMembership[]> {
    return getDemoState().memberships.filter((membership) => membership.companyId === companyId);
  }

  async getMembership(companyId: string, userId: string): Promise<CompanyMembership | null> {
    return getDemoState().memberships.find((membership) =>
      membership.companyId === companyId && membership.userId === userId) ?? null;
  }

  async getMembershipByEmail(companyId: string, email: string): Promise<CompanyMembership | null> {
    const normalized = email.trim().toLowerCase();
    return getDemoState().memberships.find((membership) =>
      membership.companyId === companyId && membership.email === normalized) ?? null;
  }

  async findMembershipByIdentity(provider: IdentityProvider, subject: string): Promise<CompanyMembership | null> {
    return getDemoState().memberships.find((membership) =>
      membership.identityProvider === provider && membership.identitySubject === subject) ?? null;
  }

  async createMembership(membership: CompanyMembership): Promise<CompanyMembership> {
    const state = getDemoState();
    if (await this.getMembershipByEmail(membership.companyId, membership.email)) throw appError("CONFLICT");
    state.memberships.push(membership);
    saveDemoState(state);
    return membership;
  }

  async updateMembership(membership: CompanyMembership): Promise<CompanyMembership> {
    const state = getDemoState();
    const index = state.memberships.findIndex((item) =>
      item.companyId === membership.companyId && item.userId === membership.userId);
    if (index < 0) throw appError("NOT_FOUND");
    state.memberships[index] = membership;
    saveDemoState(state);
    return membership;
  }
}
