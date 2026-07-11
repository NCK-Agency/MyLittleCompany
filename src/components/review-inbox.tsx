"use client";

import { useEffect, useState } from "react";
import type { MemoryCandidate } from "@/domain/types";
import { apiRequest } from "@/lib/api";
import { BrandMark } from "./brand-mark";
import { CandidateCard } from "./candidate-card";

export function ReviewInbox() {
  const [candidates, setCandidates] = useState<MemoryCandidate[]>([]);
  const [filter, setFilter] = useState<"PROPOSED" | "HANDLED">("PROPOSED");
  const [status, setStatus] = useState("Loading suggestions…");

  useEffect(() => {
    apiRequest<MemoryCandidate[]>("/api/memory-candidates")
      .then((items) => {
        setCandidates(items);
        setStatus("");
      })
      .catch(() => setStatus("Could not load suggested company knowledge."));
  }, []);

  function update(updated: MemoryCandidate): void {
    setCandidates((items) => items.map((item) => item.id === updated.id ? updated : item));
  }

  const visible = candidates.filter((candidate) => filter === "PROPOSED" ? candidate.status === "PROPOSED" : candidate.status !== "PROPOSED");
  const pendingCount = candidates.filter((candidate) => candidate.status === "PROPOSED").length;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <header className="grid gap-8 border-b-2 border-[var(--graphite)] pb-8 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="page-kicker">Review</p>
          <h1 className="page-title mt-3">Suggested company knowledge</h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-[var(--muted)]">Nothing becomes company truth until you choose.</p>
        </div>
        <div className="flex items-center gap-4 bg-[var(--butter)] p-4 sm:min-w-72">
          <BrandMark className="size-12 shrink-0" />
          <div>
            <p className="metadata text-3xl font-black leading-none text-[var(--cobalt-deep)]">{pendingCount}</p>
            <p className="mt-1 text-sm font-bold">waiting for your review</p>
          </div>
        </div>
      </header>

      <div className="mt-7 flex w-fit border border-[var(--cobalt)] bg-white p-1">
        <button className={`min-h-11 rounded-[6px] px-4 text-sm font-bold transition-colors ${filter === "PROPOSED" ? "bg-[var(--cobalt)] text-white" : "text-[var(--cobalt-deep)] hover:bg-[var(--cobalt-soft)]"}`} onClick={() => setFilter("PROPOSED")} type="button">Needs review</button>
        <button className={`min-h-11 rounded-[6px] px-4 text-sm font-bold transition-colors ${filter === "HANDLED" ? "bg-[var(--cobalt)] text-white" : "text-[var(--cobalt-deep)] hover:bg-[var(--cobalt-soft)]"}`} onClick={() => setFilter("HANDLED")} type="button">Recently handled</button>
      </div>

      <div className="mt-7 space-y-5">
        {visible.map((candidate) => <CandidateCard candidate={candidate} key={candidate.id} onChanged={update} />)}
        {visible.length === 0 && !status && (
          <div className="grid min-h-72 place-items-center border-2 border-dashed border-[var(--border-strong)] bg-white p-8 text-center">
            <div>
              <BrandMark className="mx-auto size-14" />
              <h2 className="mt-5 text-3xl font-black uppercase">You’re caught up.</h2>
              <p className="mt-2 text-[var(--muted)]">New suggestions will appear here as you work.</p>
            </div>
          </div>
        )}
        <p aria-live="polite" className="text-sm font-bold text-[var(--cobalt)]">{status}</p>
      </div>
    </main>
  );
}
