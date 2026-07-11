"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { Company, HydratedMemory, MemoryCandidate } from "@/domain/types";
import { apiRequest } from "@/lib/api";
import { BrandMark } from "./brand-mark";
import { KnowledgePageDialog } from "./knowledge-page-dialog";
import { useViewer } from "./viewer-context";
import { isOwner } from "@/domain/authorization";
import type { OnboardingSessionView } from "./onboarding/onboarding-types";
import { onboardingPath, onboardingStep } from "./onboarding/onboarding-types";

export function HomeDashboard() {
  const viewer = useViewer();
  const owner = Boolean(viewer && isOwner(viewer));
  const canReview = owner || Boolean(viewer?.grants.some((grant) => grant.permission === "APPROVE"));
  const canRead = owner || Boolean(viewer?.grants.some((grant) => grant.permission === "READ" || grant.permission === "APPROVE"));
  const suggestionScopes = owner ? [{ level: "COMPANY" } as const] : viewer?.grants
    .filter((grant) => grant.permission === "SUGGEST")
    .map((grant) => grant.scope) ?? [];
  const [company, setCompany] = useState<Company | null>(null);
  const [pending, setPending] = useState(0);
  const [memories, setMemories] = useState<HydratedMemory[]>([]);
  const [status, setStatus] = useState("Loading your company…");
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [suggesting, setSuggesting] = useState(false);
  const [onboarding, setOnboarding] = useState<OnboardingSessionView | null>(null);

  const load = useCallback(async (): Promise<void> => {
    try {
      const [profile, candidates, current, activeOnboarding] = await Promise.all([
        apiRequest<Company>("/api/company"),
        canReview ? apiRequest<MemoryCandidate[]>("/api/memory-candidates") : Promise.resolve([]),
        canRead ? apiRequest<HydratedMemory[]>("/api/memories") : Promise.resolve([]),
        owner ? apiRequest<OnboardingSessionView | null>("/api/onboarding/sessions") : Promise.resolve(null),
      ]);
      setCompany(profile);
      setName(profile.name);
      setDescription(profile.description);
      setPending(candidates.filter((candidate) => candidate.status === "PROPOSED").length);
      setMemories(current);
      setOnboarding(activeOnboarding);
      setStatus("");
    } catch {
      setStatus("We could not load the demo company. Try refreshing the page.");
    }
  }, [canRead, canReview, owner]);

  useEffect(() => {
    const task = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(task);
  }, [load]);

  async function reset(): Promise<void> {
    setStatus("Restoring the demo company…");
    await apiRequest("/api/demo/reset", { method: "POST" });
    await load();
    setStatus("Demo company restored.");
  }

  async function saveProfile(): Promise<void> {
    setStatus("Saving company profile…");
    try {
      const updated = await apiRequest<Company>("/api/company", {
        method: "PATCH",
        body: JSON.stringify({ name, description }),
      });
      setCompany(updated);
      setEditing(false);
      setStatus("Company profile saved.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not save the company profile.");
    }
  }

  const latestMemories = memories.slice(-3).reverse();

  return (
    <main className="mx-auto w-full max-w-[90rem] px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
      <section className="grid overflow-hidden rounded-[20px] bg-[var(--cobalt)] text-white lg:min-h-[38rem] lg:grid-cols-[minmax(0,1.45fr)_minmax(22rem,0.75fr)]">
        <div className="flex flex-col p-7 sm:p-10 lg:p-14">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <p className="text-sm font-bold text-[var(--butter)]">{company?.name ?? "Maison Lumière Salon"}</p>
              <p className="mt-1 text-sm text-white/70">Explain it once. Your company remembers.</p>
            </div>
            {owner && <button className="min-h-11 rounded-[6px] border border-white/35 px-4 text-sm font-bold text-white transition-colors hover:bg-white hover:text-[var(--cobalt-deep)]" onClick={() => setEditing((value) => !value)} type="button">
              {editing ? "Cancel edit" : "Edit profile"}
            </button>}
          </div>

          <div className="my-auto py-10 lg:py-14">
            <p className="text-xs font-extrabold tracking-[0.18em] text-[var(--butter)] uppercase">Your company workspace</p>
            <h1 className="display-title mt-4 max-w-4xl">What are you working on today?</h1>
            {editing ? (
              <div className="mt-8 max-w-2xl space-y-4 rounded-xl bg-[var(--ivory)] p-5 text-[var(--graphite)] sm:p-6">
                <label className="field-label">Company name<input className="text-input" value={name} onChange={(event) => setName(event.target.value)} /></label>
                <label className="field-label">Description<textarea className="text-input min-h-28" value={description} onChange={(event) => setDescription(event.target.value)} /></label>
                <button className="primary-button" onClick={() => void saveProfile()} type="button">Save profile</button>
              </div>
            ) : (
              <p className="mt-6 max-w-2xl text-lg leading-8 text-white/75">{company?.description ?? status}</p>
            )}
            <div className="mt-8 flex flex-wrap gap-3">
              <Link className="primary-button" href="/chat?assistant=MARKETING">Start with Marketing <span aria-hidden="true" className="ml-2">→</span></Link>
              {owner && <Link className="secondary-button border-white text-white" href={onboarding ? onboardingPath(onboarding) : "/onboarding/goal"}>
                {onboarding ? `Continue setup · ${onboardingStep(onboarding)}` : "Bring in company context"}
              </Link>}
              {!owner && suggestionScopes.length > 0 && <button className="secondary-button border-white text-white" onClick={() => setSuggesting(true)} type="button">Suggest knowledge</button>}
            </div>
          </div>

          <div className="grid gap-x-8 lg:grid-cols-3">
            <Link className="action-card" href="/chat?assistant=MARKETING"><span><strong>Create a marketing idea</strong><span>Plan a quiet-day promotion</span></span></Link>
            <Link className="action-card" href="/chat?assistant=OPERATIONS"><span><strong>Document how we work</strong><span>Turn an idea into an SOP</span></span></Link>
            <Link className="action-card" href="/chat?assistant=EMPLOYEE"><span><strong>Ask about my company</strong><span>Find an approved answer</span></span></Link>
          </div>
        </div>

        <aside className="grid content-between gap-8 bg-[var(--butter)] p-7 text-[var(--graphite)] sm:p-10 lg:p-12">
          <div>
            <div className="flex items-start justify-between gap-5">
              <div>
                <p className="page-kicker text-[var(--cobalt-deep)]">Governed memory</p>
                <h2 className="mt-3 text-4xl font-black leading-[0.95] uppercase sm:text-5xl">Words become company truth only after you approve.</h2>
              </div>
              <BrandMark className="size-16 shrink-0" />
            </div>
            <ol className="mt-10 grid gap-0" aria-label="How company memory works">
              {["You say it", "You approve it", "The company remembers"].map((step, index) => (
                <li className="flex min-h-16 items-center gap-4 border-t border-[var(--cobalt-deep)]/25 py-4" key={step}>
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-[6px] bg-[var(--cobalt)] text-sm font-extrabold text-white metadata">{index + 1}</span>
                  <strong>{step}</strong>
                </li>
              ))}
            </ol>
          </div>

          {canReview && <div className="border-t-2 border-[var(--cobalt-deep)] pt-7">
            <p className="text-sm font-bold text-[var(--cobalt-deep)]">Needs your review</p>
            <div className="mt-2 flex items-end justify-between gap-5">
              <p className="font-display text-7xl font-black leading-none text-[var(--cobalt-deep)] metadata" data-testid="pending-count">{pending}</p>
              <Link className="secondary-button bg-transparent" href="/review">Open Review</Link>
            </div>
          </div>}
        </aside>
      </section>

      {canRead && <section className="mt-8 grid gap-6 border-t-2 border-[var(--graphite)] pt-7 lg:grid-cols-[0.72fr_1.28fr]">
        <div>
          <p className="page-kicker">Company Playbook</p>
          <h2 className="mt-2 text-4xl font-black uppercase sm:text-5xl">Recent approved knowledge</h2>
          <Link className="quiet-button mt-4 -ml-4" href="/playbook">View the complete Playbook →</Link>
        </div>
        <div className="divide-y divide-[var(--border-strong)] border-y border-[var(--border-strong)]">
          {latestMemories.map((memory) => (
            <Link className="group flex min-h-20 items-center justify-between gap-5 py-4 no-underline" href={`/playbook/${memory.record.id}`} key={memory.record.id}>
              <span className="font-bold group-hover:text-[var(--cobalt)]">{memory.version.title}</span>
              <span className="metadata shrink-0 text-xs font-bold text-[var(--muted)]">V{memory.version.version} · APPROVED</span>
            </Link>
          ))}
          {latestMemories.length === 0 && <p className="py-8 text-[var(--muted)]">Approved knowledge will appear here after your first review.</p>}
        </div>
      </section>}

      <footer className="mt-7 flex flex-wrap items-center justify-between gap-4 border-t border-[var(--border)] py-5 text-sm text-[var(--muted)]">
        <p aria-live="polite">{status}</p>
        <div className="flex flex-wrap gap-2">
          {owner && <Link className="secondary-button" href="/workspace/access">People & access</Link>}
          {owner && <button className="secondary-button" onClick={() => void reset()} type="button">Reset demo</button>}
        </div>
      </footer>
      {suggesting && company && <KnowledgePageDialog
        allowedScopes={suggestionScopes}
        company={company}
        initialScope={suggestionScopes[0]}
        mode="suggestion"
        onClose={() => setSuggesting(false)}
        onSuggested={() => {
          setSuggesting(false);
          setStatus("Suggestion sent for review.");
        }}
      />}
    </main>
  );
}
