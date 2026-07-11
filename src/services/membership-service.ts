import { actorFromMembership, isOwner, scopeKey } from "@/domain/authorization";
import { appError } from "@/domain/errors";
import { inviteMembershipSchema, updateMembershipSchema } from "@/domain/schemas";
import type {
  AccessGrant,
  ActorContext,
  AuditEvent,
  CompanyMembership,
  IdentityProvider,
  KnowledgeScope,
} from "@/domain/types";
import type { CompanyRepository } from "@/ports/company-repository";
import type { IdentityAdmin } from "@/ports/identity-admin";
import type { MembershipRepository } from "@/ports/membership-repository";
import type { MemoryRepository } from "@/ports/memory-repository";

function assertOwner(actor: ActorContext): void {
  if (!isOwner(actor)) throw appError("FORBIDDEN");
}

function normalizeGrants(grants: AccessGrant[]): AccessGrant[] {
  const seen = new Set<string>();
  return grants.map((grant) => {
    const key = `${grant.permission}:${scopeKey(grant.scope)}`;
    if (seen.has(key)) throw appError("CONFLICT");
    seen.add(key);
    return grant;
  });
}

export class MembershipService {
  constructor(
    private readonly memberships: MembershipRepository,
    private readonly identities: IdentityAdmin,
    private readonly companies: CompanyRepository,
    private readonly memories: MemoryRepository,
  ) {}

  async resolveActor(provider: IdentityProvider, subject: string): Promise<ActorContext> {
    const membership = await this.establishSession(provider, subject);
    if (membership.status === "DISABLED") throw appError("FORBIDDEN");
    return actorFromMembership(membership);
  }

  async establishSession(provider: IdentityProvider, subject: string): Promise<CompanyMembership> {
    const membership = await this.memberships.findMembershipByIdentity(provider, subject);
    if (!membership) throw appError("FORBIDDEN");
    if (membership.status === "INVITED") {
      return this.memberships.updateMembership({
        ...membership,
        status: "ACTIVE",
        updatedAt: new Date().toISOString(),
      });
    }
    return membership;
  }

  async list(actor: ActorContext): Promise<CompanyMembership[]> {
    assertOwner(actor);
    return this.memberships.listMemberships(actor.companyId);
  }

  async invite(input: unknown, actor: ActorContext): Promise<CompanyMembership> {
    assertOwner(actor);
    const values = inviteMembershipSchema.parse(input);
    if (await this.memberships.getMembershipByEmail(actor.companyId, values.email)) throw appError("CONFLICT");
    const grants = normalizeGrants(values.grants);
    await this.assertScopes(grants.map((grant) => grant.scope), actor.companyId);
    const identity = await this.identities.invite(values);
    const now = new Date().toISOString();
    const membership = await this.memberships.createMembership({
      companyId: actor.companyId,
      userId: `user-${crypto.randomUUID()}`,
      email: identity.email,
      displayName: values.displayName,
      identityProvider: identity.provider,
      identitySubject: identity.subject,
      roles: values.roles,
      grants,
      status: "INVITED",
      createdAt: now,
      updatedAt: now,
    });
    await this.audit(actor, "MEMBER_INVITED", membership.userId);
    return membership;
  }

  async update(userId: string, input: unknown, actor: ActorContext): Promise<CompanyMembership> {
    assertOwner(actor);
    const values = updateMembershipSchema.parse(input);
    const membership = await this.memberships.getMembership(actor.companyId, userId);
    if (!membership) throw appError("NOT_FOUND");
    if (membership.roles.includes("OWNER") || membership.userId === actor.userId) {
      throw appError("FORBIDDEN");
    }
    const grants = normalizeGrants(values.grants);
    await this.assertScopes(grants.map((grant) => grant.scope), actor.companyId);
    const updated = await this.memberships.updateMembership({
      ...membership,
      displayName: values.displayName,
      roles: values.roles,
      grants,
      status: values.status,
      updatedAt: new Date().toISOString(),
    });
    await this.audit(
      actor,
      values.status === membership.status ? "MEMBER_ACCESS_UPDATED" : `MEMBER_${values.status}`,
      userId,
    );
    return updated;
  }

  private async assertScopes(scopes: KnowledgeScope[], companyId: string): Promise<void> {
    const company = await this.companies.get(companyId);
    if (!company) throw appError("NOT_FOUND");
    for (const scope of scopes) {
      if (scope.level === "COMPANY") continue;
      const valid = company.organizationalUnits.some((unit) =>
        unit.companyId === companyId
        && unit.type === "DEPARTMENT"
        && unit.id === scope.organizationalUnitId);
      if (!valid) throw appError("FORBIDDEN");
    }
  }

  private async audit(actor: ActorContext, action: string, targetId: string): Promise<void> {
    const event: AuditEvent = {
      id: `audit-${crypto.randomUUID()}`,
      companyId: actor.companyId,
      actorId: actor.userId,
      action,
      targetType: "MEMBERSHIP",
      targetId,
      createdAt: new Date().toISOString(),
    };
    await this.memories.appendAudit(event);
  }
}
