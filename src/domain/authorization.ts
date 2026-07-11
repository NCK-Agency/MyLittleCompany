import type {
  ActorContext,
  CompanyMembership,
  KnowledgePermission,
  KnowledgeScope,
} from "./types";

export function isOwner(actor: ActorContext): boolean {
  return actor.roles.includes("OWNER");
}

function permissionMatches(granted: KnowledgePermission, requested: KnowledgePermission): boolean {
  return granted === requested || (granted === "APPROVE" && requested === "READ");
}

export function canAccess(
  actor: ActorContext,
  permission: KnowledgePermission,
  target: KnowledgeScope,
): boolean {
  if (isOwner(actor)) return true;
  return actor.grants.some((grant) => {
    if (!permissionMatches(grant.permission, permission)) return false;
    if (grant.scope.level === "COMPANY") return true;
    if (permission === "READ" && target.level === "COMPANY") return true;
    return target.level === "DEPARTMENT"
      && grant.scope.organizationalUnitId === target.organizationalUnitId;
  });
}

export function actorFromMembership(membership: CompanyMembership): ActorContext {
  return {
    userId: membership.userId,
    companyId: membership.companyId,
    email: membership.email,
    displayName: membership.displayName,
    roles: membership.roles,
    grants: membership.grants,
    organizationalUnitIds: membership.grants.flatMap((grant) =>
      grant.scope.level === "DEPARTMENT" && grant.scope.organizationalUnitId
        ? [grant.scope.organizationalUnitId]
        : []),
    demoMode: membership.identityProvider === "DEMO",
  };
}

export function scopeKey(scope: KnowledgeScope): string {
  return scope.level === "COMPANY" ? "COMPANY" : `DEPARTMENT:${scope.organizationalUnitId ?? ""}`;
}
