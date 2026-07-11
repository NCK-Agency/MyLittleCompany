"use client";

import { useState } from "react";
import type { MemoryCandidate } from "@/domain/types";
import { apiRequest } from "@/lib/api";

export function CandidateCard({ candidate, onChanged }: { candidate: MemoryCandidate; onChanged?: (candidate: MemoryCandidate) => void }) {
  const [current, setCurrent] = useState(candidate);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(candidate.title);
  const [statement, setStatement] = useState(candidate.statement);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [approvedMemoryId, setApprovedMemoryId] = useState(current.approvedMemoryId ?? "");
  const [indexStatus, setIndexStatus] = useState("");

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
    } catch (error) { setMessage(error instanceof Error ? error.message : "Approval failed."); }
    finally { setBusy(false); }
  }

  async function retryIndex(): Promise<void> {
    setBusy(true);
    try {
      const memory = await apiRequest<{ record: { indexStatus: string } }>(`/api/memories/${approvedMemoryId}/retry-index`, { method: "POST" });
      setIndexStatus(memory.record.indexStatus);
      setMessage(memory.record.indexStatus === "READY" ? "Ready in the Playbook and search." : "Adding to search still needs attention.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not retry adding to search."); }
    finally { setBusy(false); }
  }

  async function ignore(): Promise<void> {
    setBusy(true);
    try {
      const updated = await apiRequest<MemoryCandidate>(`/api/memory-candidates/${current.id}/reject`, { method: "POST" });
      setCurrent(updated); setMessage("Ignored. This will not become company knowledge."); onChanged?.(updated);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not ignore this suggestion."); }
    finally { setBusy(false); }
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
      setCurrent(updated); setEditing(false); setMessage("Edits saved. Still waiting for approval."); onChanged?.(updated);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save edits."); }
    finally { setBusy(false); }
  }

  return (
    <article className="rounded-3xl border border-[#d7c8b9] bg-[#fffaf1] p-6 shadow-sm" data-testid="candidate-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="rounded-full bg-[#eee0cf] px-3 py-1 text-xs font-bold tracking-wide text-[var(--accent-strong)]">SUGGESTED COMPANY KNOWLEDGE · {current.type}</span>
        <span className="text-xs font-semibold text-[var(--muted)]">{current.status === "PROPOSED" ? "Awaiting review" : current.status}</span>
      </div>
      {editing ? (
        <div className="mt-5 space-y-3">
          <label className="field-label">Title<input className="text-input" value={title} onChange={(event) => setTitle(event.target.value)} /></label>
          <label className="field-label">What MLC heard<textarea className="text-input min-h-28" value={statement} onChange={(event) => setStatement(event.target.value)} /></label>
        </div>
      ) : (
        <><h3 className="mt-5 text-xl font-semibold">{current.title}</h3><p className="mt-3 leading-7 text-[var(--muted)]">{current.statement}</p></>
      )}
      <div className="mt-5 grid gap-4 border-t border-[#e2d7ca] pt-5 text-sm sm:grid-cols-2">
        <div><strong className="block text-[var(--foreground)]">Why it matters</strong><span className="mt-1 block text-[var(--muted)]">{current.rationale ?? "Rationale not provided."}</span></div>
        <div><strong className="block text-[var(--foreground)]">Applies to</strong><span className="mt-1 block text-[var(--muted)]">{current.appliesToRoles.join(" · ")}</span></div>
        <div><strong className="block text-[var(--foreground)]">Source</strong><span className="mt-1 block text-[var(--muted)]">{current.sourceRefs[0]?.label}</span></div>
      </div>
      {current.status === "PROPOSED" && <div className="mt-6 flex flex-wrap gap-3">
        {editing ? <button className="primary-button" disabled={busy} onClick={() => void saveEdit()} type="button">Save edits</button> : <button className="primary-button" disabled={busy} onClick={() => void approve()} type="button">Approve</button>}
        <button className="secondary-button" disabled={busy} onClick={() => setEditing((value) => !value)} type="button">{editing ? "Cancel" : "Edit"}</button>
        {!editing && <button className="quiet-button" disabled={busy} onClick={() => void ignore()} type="button">Ignore</button>}
      </div>}
      {current.status === "APPROVED" && indexStatus === "FAILED" && <button className="secondary-button mt-5" disabled={busy} onClick={() => void retryIndex()} type="button">Retry adding to search</button>}
      <p aria-live="polite" className="mt-3 text-sm font-medium text-[var(--accent)]">{message}</p>
    </article>
  );
}
