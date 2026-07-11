import type { ActorContext, HydratedMemory } from "./types";
import { canAccess, isOwner } from "./authorization";

export function isMemoryEligible(
  memory: HydratedMemory,
  actor: ActorContext,
  requestedRoles?: ActorContext["roles"],
): boolean {
  const { record, version } = memory;
  if (record.companyId !== actor.companyId || version.companyId !== actor.companyId) return false;
  if (record.status !== "APPROVED" || record.indexStatus !== "READY") return false;
  if (record.currentVersion !== version.version) return false;
  if (!canAccess(actor, "READ", record.scope)) return false;
  if (record.sensitivity === "CONFIDENTIAL" && !isOwner(actor)) return false;
  if (isOwner(actor) && requestedRoles === undefined) return true;
  return (requestedRoles ?? actor.roles).some((role) => record.appliesToRoles.includes(role));
}
