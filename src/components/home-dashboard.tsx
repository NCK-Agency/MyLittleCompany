"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Company, HydratedMemory, MemoryCandidate } from "@/domain/types";
import { apiRequest } from "@/lib/api";

export function HomeDashboard() {
  const [company, setCompany] = useState<Company | null>(null);
  const [pending, setPending] = useState(0);
  const [memories, setMemories] = useState<HydratedMemory[]>([]);
  const [status, setStatus] = useState("Loading your company…");
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  async function load(): Promise<void> {
    try {
      const [profile, candidates, current] = await Promise.all([
        apiRequest<Company>("/api/company"),
        apiRequest<MemoryCandidate[]>("/api/memory-candidates"),
        apiRequest<HydratedMemory[]>("/api/memories"),
      ]);
      setCompany(profile);
      setName(profile.name);
      setDescription(profile.description);
      setPending(candidates.filter((candidate) => candidate.status === "PROPOSED").length);
      setMemories(current);
      setStatus("");
    } catch {
      setStatus("We could not load the demo company. Try refreshing the page.");
    }
  }

  useEffect(() => {
    const task = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(task);
  }, []);

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

  return (
    <main className="mx-auto w-full max-w-7xl px-5 py-10 sm:px-8 lg:py-14">
      <section className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[2rem] border border-[var(--border)] bg-[var(--surface)] p-8 shadow-[0_28px_80px_rgb(67_49_35/8%)] sm:p-12">
          <div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-sm font-semibold text-[var(--accent)]">{company?.name ?? "Maison Lumière Salon"}</p><p className="mt-1 text-xs text-[var(--muted)]">Explain it once. Your company remembers.</p></div><button className="quiet-button" onClick={() => setEditing((value) => !value)} type="button">{editing ? "Cancel edit" : "Edit profile"}</button></div>
          <h1 className="mt-5 max-w-3xl text-4xl font-semibold tracking-[-0.04em] text-balance sm:text-6xl">
            What are you working on today?
          </h1>
          {editing ? <div className="mt-6 max-w-2xl space-y-4"><label className="field-label">Company name<input className="text-input" value={name} onChange={(event) => setName(event.target.value)} /></label><label className="field-label">Description<textarea className="text-input min-h-28" value={description} onChange={(event) => setDescription(event.target.value)} /></label><button className="primary-button" onClick={() => void saveProfile()} type="button">Save profile</button></div> : <p className="mt-6 max-w-2xl text-lg leading-8 text-[var(--muted)]">{company?.description ?? status}</p>}
          <div className="mt-9 grid gap-3 sm:grid-cols-3">
            <Link className="action-card" href="/chat?assistant=MARKETING"><strong>Create a marketing idea</strong><span>Plan a quiet-day promotion</span></Link>
            <Link className="action-card" href="/chat?assistant=OPERATIONS"><strong>Document how we work</strong><span>Turn an idea into an SOP</span></Link>
            <Link className="action-card" href="/chat?assistant=EMPLOYEE"><strong>Ask about my company</strong><span>Find an approved answer</span></Link>
          </div>
        </div>
        <aside className="space-y-5">
          <div className="rounded-3xl bg-[var(--accent)] p-7 text-white">
            <p className="text-sm text-white/75">Needs your review</p>
            <p className="mt-2 text-5xl font-semibold" data-testid="pending-count">{pending}</p>
            <Link className="mt-6 inline-flex rounded-full bg-white px-4 py-2 text-sm font-semibold text-[var(--accent-strong)]" href="/review">Open Review</Link>
          </div>
          <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-7">
            <div className="flex items-center justify-between"><h2 className="font-semibold">Recent company knowledge</h2><Link className="text-sm text-[var(--accent)]" href="/playbook">View all</Link></div>
            <ul className="mt-5 space-y-3">
              {memories.slice(-3).reverse().map((memory) => <li className="rounded-2xl bg-[#f3eee6] p-4 text-sm" key={memory.record.id}>{memory.version.title}</li>)}
            </ul>
          </div>
        </aside>
      </section>
      <div className="mt-7 flex items-center justify-between gap-4 text-sm text-[var(--muted)]">
        <p aria-live="polite">{status}</p>
        <button className="secondary-button" onClick={() => void reset()} type="button">Reset demo</button>
      </div>
    </main>
  );
}
