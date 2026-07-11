"use client";

import { useState, useSyncExternalStore } from "react";

interface WaitlistResponse {
  data?: { message?: string };
  error?: { message?: string };
}

const subscribeToHydration = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export function WaitlistForm() {
  const hydrated = useSyncExternalStore(subscribeToHydration, getClientSnapshot, getServerSnapshot);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<{ tone: "success" | "error"; message: string } | null>(null);

  async function submit(formData: FormData): Promise<void> {
    setSubmitting(true);
    setStatus(null);
    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.get("email"),
          displayName: formData.get("displayName"),
          companyName: formData.get("companyName"),
          website: formData.get("website"),
        }),
      });
      const payload = await response.json() as WaitlistResponse;
      if (!response.ok) throw new Error(payload.error?.message ?? "We could not add you right now.");
      setStatus({
        tone: "success",
        message: payload.data?.message ?? "You’re on the waitlist. We’ll be in touch.",
      });
    } catch (error) {
      setStatus({
        tone: "error",
        message: error instanceof Error ? error.message : "We could not add you right now. Please try again.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form action={submit} className="waitlist-form">
      <div className="waitlist-form-grid">
        <label className="field-label" htmlFor="waitlist-name">
          Your name <span>Optional</span>
          <input autoComplete="name" className="text-input" disabled={!hydrated || submitting} id="waitlist-name" maxLength={120} name="displayName" />
        </label>
        <label className="field-label" htmlFor="waitlist-company">
          Company <span>Optional</span>
          <input autoComplete="organization" className="text-input" disabled={!hydrated || submitting} id="waitlist-company" maxLength={160} name="companyName" />
        </label>
      </div>
      <label className="field-label" htmlFor="waitlist-email">
        Work email
        <input autoComplete="email" className="text-input" disabled={!hydrated || submitting} id="waitlist-email" maxLength={320} name="email" required type="email" />
      </label>
      <label aria-hidden="true" className="waitlist-honeypot" htmlFor="waitlist-website">
        Website
        <input autoComplete="off" disabled={!hydrated || submitting} id="waitlist-website" name="website" tabIndex={-1} />
      </label>
      <button className="primary-button waitlist-submit" disabled={!hydrated || submitting} type="submit">
        {submitting ? "Joining…" : "Join the waitlist"}
      </button>
      <p className="waitlist-privacy">We’ll only use your email for My Little Company access updates.</p>
      <p aria-live="polite" className={`waitlist-status ${status ? `waitlist-status-${status.tone}` : ""}`} role="status">
        {status?.message}
      </p>
    </form>
  );
}
