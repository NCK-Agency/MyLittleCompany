import type { HydratedMemory } from "./types";

export function renderMemoryDocument({ record, version }: HydratedMemory): string {
  return [
    `# ${version.title}`,
    "",
    `- Company ID: ${record.companyId}`,
    `- Memory ID: ${record.id}`,
    `- Version: ${version.version}`,
    `- Type: ${record.type}`,
    `- Status: ${record.status}`,
    `- Applies to: ${record.appliesToRoles.join(", ")}`,
    "",
    "## Company rule",
    "",
    version.statement,
    "",
    "## Rationale",
    "",
    version.rationale ?? "Rationale not provided.",
    "",
    "## Sources",
    "",
    ...version.sourceRefs.map((source) => `- ${source.label}`),
    "",
    "## Approval",
    "",
    `Approved by ${version.approvedBy} at ${version.approvedAt}`,
    "",
  ].join("\n");
}
