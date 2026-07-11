"use client";

import { useMemo, useState } from "react";
import type {
  Company,
  CompanyRole,
  Conversation,
  HydratedMemory,
  KnowledgeScope,
  MemoryCandidate,
  MemoryType,
  Message,
} from "@/domain/types";
import { apiRequest } from "@/lib/api";

const memoryTypes: Array<{ value: MemoryType; label: string }> = [
  { value: "COMPANY_FACT", label: "Company fact" },
  { value: "CUSTOMER_INSIGHT", label: "Customer insight" },
  { value: "BRAND_RULE", label: "Brand rule" },
  { value: "POLICY", label: "Policy" },
  { value: "DECISION", label: "Decision" },
  { value: "SOP", label: "Procedure" },
  { value: "LESSON", label: "Lesson" },
];

const selectableRoles: CompanyRole[] = [
  "OWNER",
  "MANAGER",
  "MARKETING",
  "OPERATIONS",
  "SALES",
  "FRONT_DESK",
  "EMPLOYEE",
];
const companyScope: KnowledgeScope = { level: "COMPANY" };

function initialTitle(statement: string): string {
  const compact = statement.replaceAll(/\s+/g, " ").trim();
  if (!compact) return "New company knowledge";
  return compact.length > 72 ? `${compact.slice(0, 69).trim()}…` : compact;
}

export function KnowledgePageDialog({
  company,
  conversation,
  messages = [],
  initialStatement = "",
  initialScope = companyScope,
  onClose,
  onSaved,
  onSuggested,
  mode = "approved",
  allowedScopes,
}: {
  company: Company | null;
  conversation?: Conversation | null;
  messages?: Message[];
  initialStatement?: string;
  initialScope?: KnowledgeScope;
  onClose(): void;
  onSaved?(memory: HydratedMemory): void;
  onSuggested?(candidate: MemoryCandidate): void;
  mode?: "approved" | "suggestion";
  allowedScopes?: KnowledgeScope[];
}) {
  const [title, setTitle] = useState(() => initialTitle(initialStatement));
  const [statement, setStatement] = useState(initialStatement);
  const [rationale, setRationale] = useState("");
  const [type, setType] = useState<MemoryType>("DECISION");
  const [scope, setScope] = useState<KnowledgeScope>(initialScope);
  const [roles, setRoles] = useState<CompanyRole[]>(["OWNER", "MARKETING", "OPERATIONS", "SALES", "FRONT_DESK", "EMPLOYEE"]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const companyAllowed = !allowedScopes || allowedScopes.some((item) => item.level === "COMPANY");
  const departmentAllowed = (id: string): boolean => !allowedScopes || allowedScopes.some((item) =>
    item.level === "DEPARTMENT" && item.organizationalUnitId === id);

  const sourceMessageIds = useMemo(
    () => messages.slice(-4).map((message) => message.id),
    [messages],
  );

  function toggleRole(role: CompanyRole): void {
    setRoles((current) => current.includes(role)
      ? current.length === 1 ? current : current.filter((item) => item !== role)
      : [...current, role]);
  }

  async function save(): Promise<void> {
    setBusy(true);
    setStatus(mode === "approved" ? "Saving approved company knowledge…" : "Sending for review…");
    try {
      const payload = {
        title,
        statement,
        rationale: rationale.trim() || null,
        type,
        appliesToRoles: roles,
        sensitivity: "INTERNAL" as const,
        tags: [],
        scope,
        conversationId: conversation?.id,
        sourceMessageIds: conversation ? sourceMessageIds : [],
      };
      if (mode === "suggestion") {
        const candidate = await apiRequest<MemoryCandidate>("/api/memory-candidates", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setStatus("Sent for review. It is not company truth yet.");
        onSuggested?.(candidate);
        return;
      }
      const memory = await apiRequest<HydratedMemory>("/api/memories", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setStatus(memory.record.indexStatus === "READY"
        ? "Saved and available to assistants."
        : "Saved in the Playbook. Assistant search still needs attention.");
      onSaved?.(memory);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not save this knowledge page.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div aria-labelledby="knowledge-dialog-title" aria-modal="true" className="knowledge-dialog-backdrop" role="dialog">
      <form
        className="knowledge-dialog"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <header className="knowledge-dialog-header">
          <div>
            <p className="page-kicker">{mode === "approved" ? "Save knowledge" : "Suggest knowledge"}</p>
            <h2 id="knowledge-dialog-title">{mode === "approved" ? "Create a trusted page" : "Send a suggestion"}</h2>
            <p>{mode === "approved" ? "Review what will become approved company knowledge." : "An authorized person must approve this before the company uses it."}</p>
          </div>
          <button aria-label="Close save knowledge" className="icon-button" disabled={busy} onClick={onClose} type="button">×</button>
        </header>

        {conversation && (
          <div className="knowledge-source-note">
            <strong>Source</strong>
            <span>{conversation.title} · {sourceMessageIds.length} recent message{sourceMessageIds.length === 1 ? "" : "s"}</span>
          </div>
        )}

        <div className="knowledge-dialog-fields">
          <label className="field-label">Page title
            <input className="text-input" maxLength={120} onChange={(event) => setTitle(event.target.value)} required value={title} />
          </label>
          <label className="field-label">Company knowledge
            <textarea className="text-input min-h-40 resize-y" maxLength={2000} onChange={(event) => setStatement(event.target.value)} required value={statement} />
          </label>
          <label className="field-label">Why this matters
            <textarea className="text-input min-h-24 resize-y" maxLength={2000} onChange={(event) => setRationale(event.target.value)} value={rationale} />
          </label>

          <div className="knowledge-dialog-grid">
            <label className="field-label">Knowledge type
              <select className="text-input" onChange={(event) => setType(event.target.value as MemoryType)} value={type}>
                {memoryTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </label>
            <label className="field-label">Where it applies
              <select
                className="text-input"
                onChange={(event) => setScope(event.target.value === "COMPANY"
                  ? { level: "COMPANY" }
                  : { level: "DEPARTMENT", organizationalUnitId: event.target.value })}
                value={scope.level === "COMPANY" ? "COMPANY" : scope.organizationalUnitId}
              >
                {companyAllowed && <option value="COMPANY">Entire company</option>}
                {company?.organizationalUnits
                  .filter((unit) => unit.type === "DEPARTMENT" && departmentAllowed(unit.id))
                  .map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
              </select>
            </label>
          </div>

          <fieldset>
            <legend className="field-label">Who should use this?</legend>
            <div className="role-picker">
              {selectableRoles.map((role) => (
                <label key={role}>
                  <input checked={roles.includes(role)} onChange={() => toggleRole(role)} type="checkbox" />
                  {role.replaceAll("_", " ")}
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        <footer className="knowledge-dialog-footer">
          <p aria-live="polite">{status}</p>
          <div>
            <button className="secondary-button" disabled={busy} onClick={onClose} type="button">Cancel</button>
            <button className="primary-button" disabled={busy} type="submit">{mode === "approved" ? "Save approved page" : "Send for review"}</button>
          </div>
        </footer>
      </form>
    </div>
  );
}
