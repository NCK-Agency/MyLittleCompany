import type { ActorContext, HydratedMemory } from "./types";

export function isMemoryEligible(memory: HydratedMemory, actor: ActorContext): boolean {
  const { record, version } = memory;
  if (record.companyId !== actor.companyId || version.companyId !== actor.companyId) return false;
  if (record.status !== "APPROVED" || record.indexStatus !== "READY") return false;
  if (record.currentVersion !== version.version) return false;
  if (actor.roles.includes("OWNER")) return true;
  if (record.sensitivity === "CONFIDENTIAL" && !actor.roles.includes("OWNER")) return false;
  return actor.roles.some((role) => record.appliesToRoles.includes(role));
}
