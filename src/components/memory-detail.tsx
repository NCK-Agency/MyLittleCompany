"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Company, CompanyRole, HydratedMemory, KnowledgeScope, MemoryDetail as MemoryDetailData } from "@/domain/types";
import { apiRequest } from "@/lib/api";
import { BrandMark } from "./brand-mark";
import { isOwner } from "@/domain/authorization";
import { useViewer } from "./viewer-context";

const companyRoles: CompanyRole[] = [
  "MARKETING",
  "OPERATIONS",
  "SALES",
  "FRONT_DESK",
  "EMPLOYEE",
  "OWNER",
];

interface MemoryDraft {
  title: string;
  statement: string;
  rationale: string;
  appliesToRoles: CompanyRole[];
  scope: KnowledgeScope;
}

export function MemoryDetail({ memoryId }: { memoryId: string }) {
  const viewer = useViewer();
  const owner = Boolean(viewer && isOwner(viewer));
  const [memory, setMemory] = useState<MemoryDetailData | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [draft, setDraft] = useState<MemoryDraft | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Loading company knowledge…");

  useEffect(() => {
    Promise.all([
      apiRequest<MemoryDetailData>(`/api/memories/${memoryId}`),
      apiRequest<Company>("/api/company"),
    ])
      .then(([item, companyResult]) => {
        setMemory(item);
        setCompany(companyResult);
        setStatus("");
      })
      .catch(() => setStatus("This Playbook entry could not be found."));
  }, [memoryId]);

  function beginEditing(): void {
    if (!memory) return;
    setDraft({
      title: memory.version.title,
      statement: memory.version.statement,
      rationale: memory.version.rationale ?? "",
      appliesToRoles: memory.version.appliesToRoles,
      scope: memory.version.scope,
    });
    setEditing(true);
    setStatus("");
  }

  function toggleRole(role: CompanyRole): void {
    setDraft((current) => {
      if (!current) return current;
      const selected = current.appliesToRoles.includes(role);
      if (selected && current.appliesToRoles.length === 1) return current;
      return {
        ...current,
        appliesToRoles: selected
          ? current.appliesToRoles.filter((item) => item !== role)
          : [...current.appliesToRoles, role],
      };
    });
  }

  async function saveEdit(): Promise<void> {
    if (!memory || !draft) return;
    setBusy(true);
    setStatus("Saving a new approved version…");
    try {
      const updated = await apiRequest<MemoryDetailData>(`/api/memories/${memoryId}`, {
        method: "PATCH",
        body: JSON.stringify({
          expectedMemoryVersion: memory.version.version,
          title: draft.title,
          statement: draft.statement,
          rationale: draft.rationale.trim() || null,
          appliesToRoles: draft.appliesToRoles,
          scope: draft.scope,
        }),
      });
      setMemory(updated);
      setEditing(false);
      setDraft(null);
      setStatus(updated.record.indexStatus === "READY"
        ? `Saved as version ${updated.version.version} and available to assistants.`
        : "Saved in the Playbook, but assistant search still needs attention.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not save this edit.");
    } finally {
      setBusy(false);
    }
  }

  async function retryIndex(): Promise<void> {
    if (!memory) return;
    setBusy(true);
    setStatus("Updating assistant search…");
    try {
      const updated = await apiRequest<HydratedMemory>(`/api/memories/${memoryId}/retry-index`, { method: "POST" });
      setMemory({ ...memory, record: updated.record, version: updated.version });
      setStatus(updated.record.indexStatus === "READY"
        ? "This entry is now available to assistants."
        : "The Playbook entry is safe, but assistant search could not be updated yet.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not update assistant search.");
    } finally {
      setBusy(false);
    }
  }

  if (!memory) {
    return <main className="mx-auto max-w-4xl p-8"><p className="font-bold text-[var(--cobalt)]">{status}</p></main>;
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <Link className="quiet-button -ml-4" href="/playbook">← Back to Playbook</Link>
      <article className="mt-5 overflow-hidden border-2 border-[var(--cobalt)] bg-white">
        <header className="grid gap-7 bg-[var(--cobalt)] p-6 text-white sm:p-9 lg:grid-cols-[1fr_auto]">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-[6px] bg-[var(--butter)] px-3 py-1.5 text-xs font-extrabold text-[var(--cobalt-deep)]">{memory.record.type.replaceAll("_", " ")} · APPROVED</span>
              <span className="metadata text-sm font-bold text-white/70">Version {memory.version.version} · {memory.record.indexStatus}</span>
            </div>
            <h1 className="mt-6 max-w-4xl text-5xl font-black leading-[0.92] uppercase sm:text-6xl">{editing ? "Edit Playbook entry" : memory.version.title}</h1>
          </div>
          <div className="flex items-start gap-3">
            {!editing && owner && <button className="secondary-button" onClick={beginEditing} type="button">Edit entry</button>}
            <BrandMark className="hidden size-20 shrink-0 sm:inline-grid" />
          </div>
        </header>

        <div className="grid lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.6fr)]">
          <div className="p-6 sm:p-9">
            {editing && draft ? (
              <form onSubmit={(event) => { event.preventDefault(); void saveEdit(); }}>
                <p className="page-kicker">Edit current company knowledge</p>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">Saving creates a new approved version. The previous wording stays in history.</p>
                <label className="field-label mt-7">Title
                  <input className="text-input" maxLength={120} onChange={(event) => setDraft({ ...draft, title: event.target.value })} required value={draft.title} />
                </label>
                <label className="field-label mt-6">Company rule or knowledge
                  <textarea className="text-input min-h-36 resize-y" maxLength={2000} onChange={(event) => setDraft({ ...draft, statement: event.target.value })} required value={draft.statement} />
                </label>
                <label className="field-label mt-6">Why this matters
                  <textarea className="text-input min-h-28 resize-y" maxLength={2000} onChange={(event) => setDraft({ ...draft, rationale: event.target.value })} value={draft.rationale} />
                </label>
                <label className="field-label mt-6">Where this applies
                  <select
                    className="text-input"
                    onChange={(event) => setDraft({
                      ...draft,
                      scope: event.target.value === "COMPANY"
                        ? { level: "COMPANY" }
                        : { level: "DEPARTMENT", organizationalUnitId: event.target.value },
                    })}
                    value={draft.scope.level === "COMPANY" ? "COMPANY" : draft.scope.organizationalUnitId}
                  >
                    <option value="COMPANY">Entire company</option>
                    {company?.organizationalUnits.filter((unit) => unit.type === "DEPARTMENT").map((unit) => (
                      <option key={unit.id} value={unit.id}>{unit.name}</option>
                    ))}
                  </select>
                </label>
                <fieldset className="mt-7">
                  <legend className="field-label">Who should use this?</legend>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {companyRoles.map((role) => (
                      <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-[6px] border border-[var(--border)] bg-[var(--surface)] px-3 text-sm font-bold" key={role}>
                        <input checked={draft.appliesToRoles.includes(role)} onChange={() => toggleRole(role)} type="checkbox" />
                        {role.replaceAll("_", " ")}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div className="mt-8 flex flex-wrap gap-3 border-t border-[var(--border)] pt-6">
                  <button className="primary-button" disabled={busy} type="submit">Save new version</button>
                  <button className="secondary-button" disabled={busy} onClick={() => { setEditing(false); setDraft(null); setStatus(""); }} type="button">Cancel</button>
                </div>
              </form>
            ) : (
              <>
                <section>
                  <p className="page-kicker">Company rule</p>
                  <p className="mt-4 whitespace-pre-wrap text-xl leading-9 text-[var(--graphite)]">{memory.version.statement}</p>
                </section>
                <section className="mt-10 border-t-2 border-[var(--graphite)] pt-7">
                  <h2 className="text-3xl font-black uppercase">Why this matters</h2>
                  <p className="mt-3 whitespace-pre-wrap leading-7 text-[var(--muted)]">{memory.version.rationale ?? "Rationale not provided."}</p>
                </section>
              </>
            )}
          </div>

          <dl className="grid content-start divide-y divide-[var(--cobalt-deep)]/20 bg-[var(--butter-soft)] p-6 text-sm sm:p-8">
            <div className="pb-5">
              <dt className="font-extrabold text-[var(--cobalt-deep)]">Knowledge scope</dt>
              <dd className="mt-1.5 text-[var(--muted)]">{memory.record.scope.level === "COMPANY"
                ? "Entire company"
                : company?.organizationalUnits.find((unit) => unit.id === memory.record.scope.organizationalUnitId)?.name ?? "Department"}</dd>
            </div>
            <div className="py-5">
              <dt className="font-extrabold text-[var(--cobalt-deep)]">Applies to</dt>
              <dd className="mt-1.5 text-[var(--muted)]">{memory.version.appliesToRoles.join(" · ")}</dd>
            </div>
            <div className="py-5">
              <dt className="font-extrabold text-[var(--cobalt-deep)]">Approved by</dt>
              <dd className="metadata mt-1.5 text-[var(--muted)]">Maya · {new Date(memory.version.approvedAt).toLocaleString()}</dd>
            </div>
            <div className="py-5">
              <dt className="font-extrabold text-[var(--cobalt-deep)]">Source</dt>
              <dd className="mt-1.5 text-[var(--muted)]">{memory.version.sourceRefs.map((source) => source.label).join(", ")}</dd>
            </div>
            <div className="pt-5">
              <dt className="font-extrabold text-[var(--cobalt-deep)]">Assistant search</dt>
              <dd className={`mt-1.5 font-bold ${memory.record.indexStatus === "READY" ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
                {memory.record.indexStatus === "READY" ? "Available to assistants" : memory.record.indexStatus === "PENDING" ? "Updating" : "Needs attention"}
              </dd>
              {memory.record.indexStatus === "FAILED" && owner && <button className="secondary-button mt-4" disabled={busy} onClick={() => void retryIndex()} type="button">Retry assistant search</button>}
              {memory.record.indexDocumentId && (
                <details className="mt-4 text-xs leading-5 text-[var(--muted)]">
                  <summary className="cursor-pointer font-bold text-[var(--cobalt-deep)]">Search details</summary>
                  <p className="mt-2 break-all">Document: {memory.record.indexDocumentId}</p>
                </details>
              )}
            </div>
          </dl>
        </div>
      </article>

      <section className="mt-10 border-t-2 border-[var(--graphite)] pt-7">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="page-kicker">Version history</p>
            <h2 className="mt-2 text-4xl font-black uppercase">What changed over time</h2>
          </div>
          <p className="metadata text-sm font-bold text-[var(--muted)]">{memory.history.length} version{memory.history.length === 1 ? "" : "s"}</p>
        </div>
        <div className="mt-5 border-t border-[var(--border-strong)]">
          {memory.history.map((version) => (
            <details className="border-b border-[var(--border-strong)] bg-white px-5 py-4" key={version.version}>
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 font-bold">
                <span>Version {version.version} · {version.title}</span>
                <span className="metadata shrink-0 text-xs text-[var(--muted)]">{new Date(version.approvedAt).toLocaleDateString()}</span>
              </summary>
              <div className="grid gap-5 border-t border-[var(--border)] pt-4 text-sm leading-6 sm:grid-cols-[1fr_16rem]">
                <div>
                  <p className="whitespace-pre-wrap text-[var(--graphite)]">{version.statement}</p>
                  <p className="mt-3 whitespace-pre-wrap text-[var(--muted)]">{version.rationale ?? "Rationale not provided."}</p>
                </div>
                <div className="text-[var(--muted)]">
                  <p><strong className="text-[var(--graphite)]">Approved by:</strong> Maya</p>
                  <p className="mt-2"><strong className="text-[var(--graphite)]">Sources:</strong> {version.sourceRefs.map((source) => source.label).join(", ")}</p>
                </div>
              </div>
            </details>
          ))}
        </div>
      </section>
      <p aria-live="polite" className="mt-5 min-h-6 text-sm font-bold text-[var(--cobalt)]">{status}</p>
    </main>
  );
}
