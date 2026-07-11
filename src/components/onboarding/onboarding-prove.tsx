"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { GroundedAnswer, OnboardingSession } from "@/domain/types";
import { apiRequest } from "@/lib/api";

interface ProofResponse {
  session: OnboardingSession;
  result: GroundedAnswer;
  searchStatus: "READY" | "UPDATING" | "NEEDS_ATTENTION";
}

export function OnboardingProve({ sessionId }: { sessionId: string }) {
  const requestStarted = useRef(false);
  const [proof, setProof] = useState<ProofResponse | null>(null);
  const [status, setStatus] = useState("Checking the company knowledge you approved…");

  useEffect(() => {
    if (requestStarted.current) {
      return;
    }
    requestStarted.current = true;
    apiRequest<ProofResponse>(`/api/onboarding/sessions/${sessionId}/prove`, {
      method: "POST",
      body: JSON.stringify({}),
    }).then((result) => {
      setProof(result);
      setStatus("");
    }).catch((error) => setStatus(error instanceof Error ? error.message : "Could not answer from the approved knowledge."));
  }, [sessionId]);

  return (
    <main className="onboarding-page">
      <section className="onboarding-panel onboarding-panel-wide">
        <p className="page-kicker">Your company already remembers</p>
        <p className="onboarding-progress">Step 4 of 4 · Proof</p>
        <h1>{proof?.session.proofQuestion ?? "Testing your approved knowledge…"}</h1>
        {proof && <div className="onboarding-proof-answer">
          <p>{proof.result.answer}</p>
          <div className="onboarding-proof-sources">
            {proof.result.sourceMemories.map((source) => <Link href={`/playbook/${source.memoryId}`} key={source.memoryId}>{source.title} · approved {new Date(source.approvedAt).toLocaleDateString()}</Link>)}
          </div>
          <p className="onboarding-search-state"><strong>Assistant search:</strong> {proof.searchStatus === "READY" ? "Ready" : proof.searchStatus === "UPDATING" ? "Updating — this approved answer used the structured Playbook while search catches up." : "Needs attention — the knowledge is approved, but search indexing should be retried."}</p>
        </div>}
        <p aria-live="polite" className="onboarding-status">{status}</p>
        {proof && <div className="onboarding-actions">
          <Link className="primary-button" href="/workspace">Go to my workspace</Link>
          <Link className="secondary-button" href="/review">Review the rest</Link>
          <Link className="quiet-button" href="/onboarding/goal">Add another source</Link>
        </div>}
      </section>
    </main>
  );
}
