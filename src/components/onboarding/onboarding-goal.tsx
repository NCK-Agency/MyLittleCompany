"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";
import type { OnboardingSessionView } from "./onboarding-types";

const examples = [
  "What discount can our team offer a customer?",
  "How should our brand sound when we talk to customers?",
  "Who are our best customers?",
  "What process should the team follow every time?",
];

const subscribeToHydration = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export function OnboardingGoal() {
  const router = useRouter();
  const hydrated = useSyncExternalStore(subscribeToHydration, getClientSnapshot, getServerSnapshot);
  const [question, setQuestion] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function continueSetup(): Promise<void> {
    setBusy(true);
    setStatus("Starting your company setup…");
    try {
      const view = await apiRequest<OnboardingSessionView>("/api/onboarding/sessions", {
        method: "POST",
        body: JSON.stringify({ proofQuestion: question }),
      });
      router.push(`/onboarding/source/${view.session.id}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not start setup.");
      setBusy(false);
    }
  }

  return (
    <main className="onboarding-page">
      <section className="onboarding-panel">
        <p className="page-kicker">Bring your company with you</p>
        <p className="onboarding-progress">Step 1 of 4 · Choose the proof</p>
        <h1>What should My Little Company understand first?</h1>
        <p className="onboarding-lede">Choose one real question. We’ll use it to find the most useful knowledge in the context you bring next.</p>
        <label className="field-label onboarding-question">Your question
          <textarea
            autoFocus
            className="text-input min-h-28"
            disabled={!hydrated || busy}
            maxLength={500}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="For example: Can the front desk offer 25% off?"
            value={question}
          />
        </label>
        <div className="onboarding-examples" aria-label="Example questions">
          {examples.map((example) => <button disabled={!hydrated || busy} key={example} onClick={() => setQuestion(example)} type="button">{example}</button>)}
        </div>
        <div className="onboarding-actions">
          <button className="primary-button" disabled={!hydrated || busy || question.trim().length < 3} onClick={() => void continueSetup()} type="button">Choose context <span aria-hidden="true">→</span></button>
          <button className="quiet-button" disabled={!hydrated || busy} onClick={() => router.push("/workspace")} type="button">Do this later</button>
        </div>
        <p aria-live="polite" className="onboarding-status">{status}</p>
      </section>
    </main>
  );
}
