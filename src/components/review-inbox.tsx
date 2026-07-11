"use client";

import { useEffect, useState } from "react";
import type { MemoryCandidate } from "@/domain/types";
import { apiRequest } from "@/lib/api";
import { CandidateCard } from "./candidate-card";

export function ReviewInbox() {
  const [candidates, setCandidates] = useState<MemoryCandidate[]>([]);
  const [filter, setFilter] = useState<"PROPOSED" | "HANDLED">("PROPOSED");
  const [status, setStatus] = useState("Loading suggestions…");

  useEffect(() => {
    apiRequest<MemoryCandidate[]>("/api/memory-candidates")
      .then((items) => { setCandidates(items); setStatus(""); })
      .catch(() => setStatus("Could not load suggested company knowledge."));
  }, []);

  function update(updated: MemoryCandidate): void {
    setCandidates((items) => items.map((item) => item.id === updated.id ? updated : item));
  }

  const visible = candidates.filter((candidate) => filter === "PROPOSED" ? candidate.status === "PROPOSED" : candidate.status !== "PROPOSED");
  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-5"><div><p className="text-sm font-semibold text-[var(--accent)]">Review</p><h1 className="mt-2 text-4xl font-semibold tracking-tight">Suggested company knowledge</h1><p className="mt-3 text-[var(--muted)]">Nothing becomes company truth until you choose.</p></div><div className="flex rounded-full border border-[var(--border)] bg-[var(--surface)] p-1"><button className={`rounded-full px-4 py-2 text-sm ${filter === "PROPOSED" ? "bg-[#eee4d8] font-semibold" : ""}`} onClick={() => setFilter("PROPOSED")} type="button">Needs review</button><button className={`rounded-full px-4 py-2 text-sm ${filter === "HANDLED" ? "bg-[#eee4d8] font-semibold" : ""}`} onClick={() => setFilter("HANDLED")} type="button">Recently handled</button></div></div>
      <div className="mt-8 space-y-5">{visible.map((candidate) => <CandidateCard candidate={candidate} key={candidate.id} onChanged={update} />)}{visible.length === 0 && !status && <div className="rounded-3xl border border-dashed border-[var(--border)] bg-[var(--surface)] p-12 text-center"><h2 className="text-xl font-semibold">You’re caught up.</h2><p className="mt-2 text-[var(--muted)]">New suggestions will appear here as you work.</p></div>}<p aria-live="polite" className="text-sm text-[var(--accent)]">{status}</p></div>
    </main>
  );
}
