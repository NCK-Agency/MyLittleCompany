"use client";

import { useState } from "react";
import type { MemoryCandidate } from "@/domain/types";
import { apiRequest } from "@/lib/api";
import { BrandMark } from "./brand-mark";
import { canAccess, isOwner } from "@/domain/authorization";
import { useViewer } from "./viewer-context";

export function CandidateCard({ candidate, onChanged }: { candidate: MemoryCandidate; onChanged?: (candidate: MemoryCandidate) => void }) {
  const viewer = useViewer();
  const canApprove = Boolean(viewer && canAccess(viewer, "APPROVE", candidate.scope));
  const owner = Boolean(viewer && isOwner(viewer));
  const [current, setCurrent] = useState(candidate);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(candidate.title);
  const [statement, setStatement] = useState(candidate.statement);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [approvedMemoryId, setApprovedMemoryId] = useState(current.approvedMemoryId ?? "");
  const [indexStatus, setIndexStatus] = useState("");
  const [exceptionCondition, setExceptionCondition] = useState("");

  async function approve(): Promise<void> {
    setBusy(true);
    try {
      const memory = await apiRequest<{ record: { id: string; indexStatus: string } }>(`/api/memory-candidates/${current.id}/approve`, {
        method: "POST",
        body: JSON.stringify({ expectedCandidateVersion: current.version }),
      });
      const updated = { ...current, status: "APPROVED" as const };
      setCurrent(updated);
      setApprovedMemoryId(memory.record.id);
      setIndexStatus(memory.record.indexStatus);
      setMessage(memory.record.indexStatus === "READY" ? "Approved and ready in the Playbook." : memory.record.indexStatus === "FAILED" ? "Approved in the Playbook, but adding to search failed." : "Approved; adding to search.");
      onChanged?.(updated);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Approval failed.");
    } finally {
      setBusy(false);
    }
  }

  async function resolve(resolution: "UPDATE" | "REPLACE" | "EXCEPTION"): Promise<void> {
    setBusy(true);
    try {
      const memory = await apiRequest<{ record: { id: string; indexStatus: string } }>(`/api/memory-candidates/${current.id}/resolve`, {
        method: "POST",
        body: JSON.stringify({
          expectedCandidateVersion: current.version,
          resolution,
          condition: resolution === "EXCEPTION" ? exceptionCondition : undefined,
        }),
      });
      const updated = { ...current, status: "APPROVED" as const };
      setCurrent(updated);
      setApprovedMemoryId(memory.record.id);
      setIndexStatus(memory.record.indexStatus);
      setMessage(memory.record.indexStatus === "READY" ? "Resolved and ready in the Playbook." : "Resolved; adding the approved version to search.");
      onChanged?.(updated);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not resolve this suggestion.");
    } finally {
      setBusy(false);
    }
  }

  async function retryIndex(): Promise<void> {
    setBusy(true);
    try {
      const memory = await apiRequest<{ record: { indexStatus: string } }>(`/api/memories/${approvedMemoryId}/retry-index`, { method: "POST" });
      setIndexStatus(memory.record.indexStatus);
      setMessage(memory.record.indexStatus === "READY" ? "Ready in the Playbook and search." : "Adding to search still needs attention.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not retry adding to search.");
    } finally {
      setBusy(false);
    }
  }

  async function ignore(): Promise<void> {
    setBusy(true);
    try {
      const updated = await apiRequest<MemoryCandidate>(`/api/memory-candidates/${current.id}/reject`, { method: "POST" });
      setCurrent(updated);
      setMessage("Ignored. This will not become company knowledge.");
      onChanged?.(updated);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not ignore this suggestion.");
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit(): Promise<void> {
    setBusy(true);
    try {
      const updated = await apiRequest<MemoryCandidate>(`/api/memory-candidates/${current.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          expectedCandidateVersion: current.version,
          title,
          statement,
          rationale: current.rationale,
          appliesToRoles: current.appliesToRoles,
          tags: current.tags,
        }),
      });
      setCurrent(updated);
      setEditing(false);
      setMessage("Edits saved. Still waiting for approval.");
      onChanged?.(updated);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save edits.");
    } finally {
      setBusy(false);
    }
  }

  const approved = current.status === "APPROVED";
  const hasConflict = current.relation === "UPDATE" || current.relation === "CONTRADICTION" || current.relation === "EXCEPTION";
  const statusLabel = approved
    ? indexStatus === "READY"
      ? "Ready in Playbook"
      : indexStatus === "FAILED"
        ? "Needs retry"
        : "Adding to Playbook"
    : current.status === "PROPOSED"
      ? "Awaiting review"
      : current.status;

  return (
    <article className={`overflow-hidden border-2 ${approved ? "border-[var(--cobalt)] bg-white" : "border-[var(--butter)] bg-[var(--butter-soft)]"}`} data-testid="candidate-card">
      <div className={`flex flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-6 ${approved ? "bg-[var(--cobalt)] text-white" : "bg-[var(--butter)] text-[var(--cobalt-deep)]"}`}>
        <div className="flex items-center gap-3">
          <BrandMark className={`size-9 shrink-0 ${approved ? "approval-snap" : ""}`} />
          <div>
            <p className="text-xs font-extrabold tracking-[0.12em] uppercase">Suggested company knowledge</p>
            <p className={`mt-0.5 text-xs font-bold ${approved ? "text-white/70" : "text-[var(--graphite)]/65"}`}>{current.type.replaceAll("_", " ")}</p>
          </div>
        </div>
        <span className={`rounded-[6px] border px-3 py-1.5 text-xs font-extrabold ${approved ? "border-white/30 bg-white/10" : "border-[var(--cobalt-deep)]/25 bg-white/35"}`}>{statusLabel}</span>
      </div>

      <div className="p-5 sm:p-6">
        {hasConflict && (
          <div className="mb-5 border-l-4 border-[var(--coral)] bg-white/65 px-4 py-3 text-sm text-[var(--graphite)]" role="status">
            <strong>Possible conflict · {current.relation.toLowerCase()}</strong>
            <p className="mt-1 text-[var(--muted)]">Review how this relates to current company knowledge before approving it.</p>
          </div>
        )}
        {current.relation === "DUPLICATE" && current.status === "PROPOSED" && (
          <div className="mb-5 border-l-4 border-[var(--cobalt)] bg-white/65 px-4 py-3 text-sm text-[var(--graphite)]" role="status">
            <strong>This appears to repeat approved knowledge.</strong>
            <p className="mt-1 text-[var(--muted)]">Edit it if something is materially different, or ignore it. A duplicate cannot be approved.</p>
          </div>
        )}
        {editing ? (
          <div className="space-y-4">
            <label className="field-label">Title<input className="text-input" value={title} onChange={(event) => setTitle(event.target.value)} /></label>
            <label className="field-label">What My Little Company heard<textarea className="text-input min-h-28" value={statement} onChange={(event) => setStatement(event.target.value)} /></label>
          </div>
        ) : (
          <>
            <h3 className="text-xl font-bold">{current.title}</h3>
            <p className="mt-3 max-w-4xl leading-7 text-[var(--muted)]">{current.statement}</p>
          </>
        )}

        <dl className="mt-6 grid gap-x-7 gap-y-5 border-t border-[var(--cobalt-deep)]/20 pt-5 text-sm sm:grid-cols-2 xl:grid-cols-4">
          <div>
            <dt className="font-extrabold text-[var(--graphite)]">Knowledge scope</dt>
            <dd className="mt-1.5 leading-6 text-[var(--muted)]">{current.scope.level === "COMPANY" ? "Entire company" : "Department"}</dd>
          </div>
          <div>
            <dt className="font-extrabold text-[var(--graphite)]">Why it matters</dt>
            <dd className="mt-1.5 leading-6 text-[var(--muted)]">{current.rationale ?? "Rationale not provided."}</dd>
          </div>
          <div>
            <dt className="font-extrabold text-[var(--graphite)]">Who it affects</dt>
            <dd className="mt-1.5 leading-6 text-[var(--muted)]">{current.appliesToRoles.join(" · ")}</dd>
          </div>
          <div>
            <dt className="font-extrabold text-[var(--graphite)]">Where it came from</dt>
            <dd className="mt-1.5 leading-6 text-[var(--muted)]">{current.sourceRefs[0]?.label}</dd>
          </div>
        </dl>

        {current.status === "PROPOSED" && canApprove && (
          <div className="mt-6 flex flex-wrap gap-3 border-t border-[var(--cobalt-deep)]/20 pt-5">
            {editing
              ? <button className="primary-button" disabled={busy} onClick={() => void saveEdit()} type="button">Save edits</button>
              : current.relation === "UNRELATED"
                ? <button className="primary-button" disabled={busy} onClick={() => void approve()} type="button">Approve</button>
                : current.relation === "UPDATE"
                  ? <button className="primary-button" disabled={busy} onClick={() => void resolve("UPDATE")} type="button">Approve as update</button>
                  : current.relation === "CONTRADICTION"
                    ? <>
                      <button className="primary-button" disabled={busy} onClick={() => void resolve("REPLACE")} type="button">Replace current rule</button>
                      <button className="secondary-button" disabled={busy || exceptionCondition.trim().length < 3} onClick={() => void resolve("EXCEPTION")} type="button">Keep as exception</button>
                    </>
                    : current.relation === "EXCEPTION"
                      ? <button className="primary-button" disabled={busy || exceptionCondition.trim().length < 3} onClick={() => void resolve("EXCEPTION")} type="button">Approve exception</button>
                      : null}
            <button className="secondary-button" disabled={busy} onClick={() => setEditing((value) => !value)} type="button">{editing ? "Cancel" : "Edit"}</button>
            {!editing && <button className="quiet-button" disabled={busy} onClick={() => void ignore()} type="button">Ignore</button>}
          </div>
        )}
        {current.status === "PROPOSED" && canApprove && !editing && (current.relation === "EXCEPTION" || current.relation === "CONTRADICTION") && (
          <label className="field-label mt-4">When is this exception allowed?
            <textarea className="text-input min-h-20" value={exceptionCondition} onChange={(event) => setExceptionCondition(event.target.value)} placeholder="Write the specific condition that makes this exception valid." />
          </label>
        )}
        {approved && indexStatus === "FAILED" && owner && <button className="secondary-button mt-5" disabled={busy} onClick={() => void retryIndex()} type="button">Retry adding to search</button>}
        <p aria-live="polite" className={`mt-4 min-h-5 text-sm font-bold ${approved ? "text-[var(--success)]" : "text-[var(--cobalt)]"}`}>{message}</p>
      </div>
    </article>
  );
}
