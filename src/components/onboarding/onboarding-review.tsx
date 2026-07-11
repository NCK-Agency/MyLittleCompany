"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { MemoryCandidate } from "@/domain/types";
import { apiRequest } from "@/lib/api";
import { CandidateCard } from "@/components/candidate-card";
import type { OnboardingSessionView } from "./onboarding-types";

export function OnboardingReview({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [view, setView] = useState<OnboardingSessionView | null>(null);
  const [handled, setHandled] = useState<string[]>([]);
  const [status, setStatus] = useState("Loading suggestions…");

  const load = useCallback(async (): Promise<void> => {
    try {
      const result = await apiRequest<OnboardingSessionView>(`/api/onboarding/sessions/${sessionId}`);
      setView(result);
      setStatus("");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not load suggestions.");
    }
  }, [sessionId]);

  useEffect(() => {
    const task = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(task);
  }, [load]);

  const ranked = useMemo(() => {
    if (!view) return [];
    const map = new Map(view.candidates.map((candidate) => [candidate.id, candidate]));
    return view.session.prioritizedCandidateIds.flatMap((id) => map.get(id) ? [map.get(id)!] : []);
  }, [view]);
  const current = ranked.find((candidate) => candidate.status === "PROPOSED" && !handled.includes(candidate.id));
  const approved = view?.candidates.some((candidate) => candidate.status === "APPROVED") ?? false;
  const position = current ? Math.max(1, ranked.findIndex((candidate) => candidate.id === current.id) + 1) : ranked.length;

  function changed(candidate: MemoryCandidate): void {
    setHandled((items) => items.includes(candidate.id) ? items : [...items, candidate.id]);
    window.setTimeout(() => void load(), 0);
  }

  return (
    <main className="onboarding-page">
      <section className="onboarding-panel onboarding-panel-wide">
        <p className="page-kicker">Suggested company knowledge</p>
        <div className="onboarding-review-heading">
          <div><p className="onboarding-progress">Step 3 of 4 · Review {position} of up to {Math.min(3, ranked.length)}</p><h1>Approve only what the company should remember.</h1></div>
          {approved && <button className="primary-button" onClick={() => router.push(`/onboarding/prove/${sessionId}`)} type="button">Prove it now <span aria-hidden="true">→</span></button>}
        </div>
        {current ? <CandidateCard candidate={current} onChanged={changed} /> : ranked.length > 0 ? (
          <div className="onboarding-finished-review">
            <h2>{approved ? "Your first company knowledge is approved." : "You reviewed the first suggestions."}</h2>
            <p>{approved ? "Now ask the question you chose and see the approved context change the answer." : "Nothing was approved, so My Little Company will not claim it as company truth."}</p>
            {!approved && <button className="secondary-button" onClick={() => router.push(`/onboarding/source/${sessionId}`)} type="button">Try another source</button>}
          </div>
        ) : <p className="onboarding-empty">No durable knowledge was found. Try context containing a lasting rule, decision, customer insight, or process.</p>}
        <p aria-live="polite" className="onboarding-status">{status}</p>
      </section>
    </main>
  );
}
