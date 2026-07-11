"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  AssistantRole,
  Company,
  Conversation,
  HydratedMemory,
  MemoryCandidate,
  MemoryType,
} from "@/domain/types";
import { isOwner } from "@/domain/authorization";
import { apiRequest } from "@/lib/api";
import { AssistantSettingsPanel } from "./assistant-settings";
import { BrandMark } from "./brand-mark";
import { KnowledgePageDialog } from "./knowledge-page-dialog";
import type { OnboardingSessionView } from "./onboarding/onboarding-types";
import { onboardingPath, onboardingStep } from "./onboarding/onboarding-types";
import { useViewer } from "./viewer-context";

const assistantLabels: Record<AssistantRole, string> = {
  MARKETING: "Marketing",
  OPERATIONS: "Operations",
  EMPLOYEE: "Employee",
};

const knowledgeTypeLabels: Record<MemoryType, string> = {
  COMPANY_FACT: "Company fact",
  CUSTOMER_INSIGHT: "Customer insight",
  BRAND_RULE: "Brand rule",
  POLICY: "Policy",
  DECISION: "Decision",
  SOP: "How we work",
  LESSON: "Lesson",
};

function formatActivity(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function HomeDashboard() {
  const viewer = useViewer();
  const owner = Boolean(viewer && isOwner(viewer));
  const canUseChat = owner || Boolean(viewer?.grants.some((grant) =>
    grant.permission === "READ" || grant.permission === "SUGGEST" || grant.permission === "APPROVE"));
  const canReview = owner || Boolean(viewer?.grants.some((grant) => grant.permission === "APPROVE"));
  const canRead = owner || Boolean(viewer?.grants.some((grant) =>
    grant.permission === "READ" || grant.permission === "APPROVE"));
  const suggestionScopes = owner ? [{ level: "COMPANY" } as const] : viewer?.grants
    .filter((grant) => grant.permission === "SUGGEST")
    .map((grant) => grant.scope) ?? [];

  const [company, setCompany] = useState<Company | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [pendingCandidates, setPendingCandidates] = useState<MemoryCandidate[]>([]);
  const [memories, setMemories] = useState<HydratedMemory[]>([]);
  const [status, setStatus] = useState("Loading your company dashboard…");
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [suggesting, setSuggesting] = useState(false);
  const [onboarding, setOnboarding] = useState<OnboardingSessionView | null>(null);

  const load = useCallback(async (): Promise<void> => {
    try {
      const [profile, conversationItems, candidates, current, activeOnboarding] = await Promise.all([
        apiRequest<Company>("/api/company"),
        canUseChat ? apiRequest<Conversation[]>("/api/conversations") : Promise.resolve([]),
        canReview ? apiRequest<MemoryCandidate[]>("/api/memory-candidates") : Promise.resolve([]),
        canRead ? apiRequest<HydratedMemory[]>("/api/memories") : Promise.resolve([]),
        owner ? apiRequest<OnboardingSessionView | null>("/api/onboarding/sessions") : Promise.resolve(null),
      ]);
      setCompany(profile);
      setName(profile.name);
      setDescription(profile.description);
      setConversations(conversationItems);
      setPendingCandidates(candidates.filter((candidate) => candidate.status === "PROPOSED"));
      setMemories(current);
      setOnboarding(activeOnboarding);
      setStatus("");
    } catch {
      setStatus("We could not load your company dashboard. Try refreshing the page.");
    }
  }, [canRead, canReview, canUseChat, owner]);

  useEffect(() => {
    const task = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(task);
  }, [load]);

  async function reset(): Promise<void> {
    setStatus("Restoring the demo company…");
    try {
      await apiRequest("/api/demo/reset", { method: "POST" });
      await load();
      setStatus("Demo company restored.");
    } catch {
      setStatus("The demo company could not be restored. Try again.");
    }
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

  const latestConversation = conversations[0] ?? null;
  const recentMemories = useMemo(() => [...memories]
    .sort((left, right) => right.record.updatedAt.localeCompare(left.record.updatedAt))
    .slice(0, 4), [memories]);

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-7 sm:px-6 lg:px-8 lg:py-10">
      <header className="flex flex-col gap-6 border-b-2 border-[var(--graphite)] pb-7 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <p className="page-kicker">Company dashboard</p>
          <h1 className="mt-3 text-5xl font-black uppercase leading-[0.9] sm:text-6xl">
            {company?.name ?? "Your company"}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--muted)]">
            {company?.description ?? "See what needs attention and pick up where you left off."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {owner && <button className="secondary-button" onClick={() => setEditing((value) => !value)} type="button">
            {editing ? "Cancel edit" : "Edit company"}
          </button>}
          {owner && <Link className="secondary-button" href="/workspace/access">People & access</Link>}
        </div>
      </header>

      {editing && <section className="mt-6 grid gap-4 border border-[var(--border-strong)] bg-white p-5 sm:p-6 lg:grid-cols-[0.7fr_1.3fr_auto] lg:items-end">
        <label className="field-label">Company name<input className="text-input" value={name} onChange={(event) => setName(event.target.value)} /></label>
        <label className="field-label">Description<textarea className="text-input min-h-24" value={description} onChange={(event) => setDescription(event.target.value)} /></label>
        <button className="primary-button" onClick={() => void saveProfile()} type="button">Save profile</button>
      </section>}

      {owner && <AssistantSettingsPanel />}

      <section className="mt-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="page-kicker">Today</p>
            <h2 className="mt-2 text-4xl font-black uppercase sm:text-5xl">What needs your attention?</h2>
          </div>
          {owner && <Link className="quiet-button" href={onboarding ? onboardingPath(onboarding) : "/onboarding/goal"}>
            {onboarding ? `Continue setup · ${onboardingStep(onboarding)}` : "Bring in company context"}
          </Link>}
        </div>

        <div className={`mt-6 grid gap-5 ${canReview ? "lg:grid-cols-[1.25fr_0.75fr]" : "grid-cols-1"}`}>
          <article className="flex min-h-72 flex-col bg-[var(--cobalt)] p-6 text-white sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[var(--butter)]">Last active conversation</p>
                {latestConversation ? <>
                  <p className="mt-5 text-sm font-bold text-white/70">{assistantLabels[latestConversation.assistantRole]} · {latestConversation.scope.level === "COMPANY" ? "Entire company" : "Department"}</p>
                  <h3 className="mt-2 max-w-3xl text-3xl font-black leading-tight sm:text-4xl">{latestConversation.title}</h3>
                  <p className="mt-3 text-sm text-white/65">Last active {formatActivity(latestConversation.updatedAt)}</p>
                </> : <>
                  <h3 className="mt-5 text-3xl font-black leading-tight sm:text-4xl">Start your first conversation</h3>
                  <p className="mt-3 max-w-xl leading-7 text-white/70">Ask for help with a real task. Useful company knowledge can be suggested along the way.</p>
                </>}
              </div>
              <BrandMark className="size-14 shrink-0 sm:size-16" />
            </div>
            <div className="mt-auto flex flex-wrap gap-3 pt-8">
              {latestConversation ? <Link className="primary-button" href={`/chat?conversation=${encodeURIComponent(latestConversation.id)}`}>Continue conversation →</Link>
                : canUseChat && <Link className="primary-button" href="/chat?assistant=MARKETING">Start a conversation →</Link>}
              {latestConversation && <Link className="secondary-button border-white" href="/chat">New conversation</Link>}
            </div>
          </article>

          {canReview && <article className="flex min-h-72 flex-col bg-[var(--butter)] p-6 text-[var(--graphite)] sm:p-8">
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[var(--cobalt-deep)]">Suggested company knowledge</p>
            <div className="mt-5 flex items-end justify-between gap-4 border-b border-[var(--cobalt-deep)]/25 pb-5">
              <p className="font-display text-7xl font-black leading-none text-[var(--cobalt-deep)] metadata" data-testid="pending-count">{pendingCandidates.length}</p>
              <p className="max-w-36 text-right text-sm font-bold leading-5">waiting for your decision</p>
            </div>
            <div className="mt-4 space-y-3">
              {pendingCandidates.slice(0, 2).map((candidate) => <p className="line-clamp-2 text-sm font-bold" key={candidate.id}>{candidate.title}</p>)}
              {pendingCandidates.length === 0 && <p className="text-sm leading-6 text-[var(--muted)]">You’re caught up. New suggestions will appear here as your company works.</p>}
            </div>
            <Link className="secondary-button mt-auto w-fit bg-transparent" href="/review">
              {pendingCandidates.length ? "Review suggestions →" : "Open Review"}
            </Link>
          </article>}
        </div>
      </section>

      {canRead && <section className="mt-10 border-t-2 border-[var(--graphite)] pt-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="page-kicker">Knowledge you can access</p>
            <h2 className="mt-2 text-4xl font-black uppercase sm:text-5xl">Your company Playbook</h2>
            <p className="mt-3 text-[var(--muted)]">{memories.length} approved {memories.length === 1 ? "entry" : "entries"} available to you.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {suggestionScopes.length > 0 && !owner && <button className="secondary-button" onClick={() => setSuggesting(true)} type="button">Suggest knowledge</button>}
            <Link className="primary-button" href="/playbook">Open Playbook →</Link>
          </div>
        </div>

        <div className="mt-6 grid border-y border-[var(--border-strong)] sm:grid-cols-2">
          {recentMemories.map((memory) => (
            <Link className="group min-h-40 border-b border-[var(--border)] p-5 no-underline transition-colors hover:bg-white sm:border-r sm:p-6" href={`/playbook/${memory.record.id}`} key={memory.record.id}>
              <div className="flex items-center justify-between gap-4">
                <span className="metadata text-xs font-extrabold uppercase tracking-[0.12em] text-[var(--cobalt)]">{knowledgeTypeLabels[memory.record.type]}</span>
                <span className="text-xs font-bold text-[var(--muted)]">Approved {formatActivity(memory.version.approvedAt)}</span>
              </div>
              <h3 className="mt-4 text-xl font-black leading-tight group-hover:text-[var(--cobalt)]">{memory.version.title}</h3>
              <p className="mt-2 line-clamp-2 text-sm leading-6 text-[var(--muted)]">{memory.version.statement}</p>
            </Link>
          ))}
          {recentMemories.length === 0 && <div className="p-7 sm:col-span-2">
            <h3 className="text-xl font-black">No approved knowledge is available yet.</h3>
            <p className="mt-2 text-[var(--muted)]">After a suggestion is approved, it will appear here for the people who can use it.</p>
          </div>}
        </div>
      </section>}

      <footer className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-[var(--border)] py-5 text-sm text-[var(--muted)]">
        <p aria-live="polite">{status}</p>
        {owner && viewer?.demoMode && <button className="secondary-button" onClick={() => void reset()} type="button">Reset demo</button>}
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
