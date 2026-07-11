"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { HydratedMemory } from "@/domain/types";
import { apiRequest } from "@/lib/api";

export function PlaybookList() {
  const [memories, setMemories] = useState<HydratedMemory[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("Loading the Playbook…");
  useEffect(() => { apiRequest<HydratedMemory[]>("/api/memories").then((items) => { setMemories(items); setStatus(""); }).catch(() => setStatus("Could not load the Playbook.")); }, []);
  const visible = useMemo(() => memories.filter((memory) => `${memory.version.title} ${memory.version.statement}`.toLowerCase().includes(query.toLowerCase())), [memories, query]);
  return <main className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8"><div><p className="text-sm font-semibold text-[var(--accent)]">Company Playbook</p><h1 className="mt-2 text-4xl font-semibold tracking-tight">Approved company knowledge</h1><p className="mt-3 text-[var(--muted)]">Current, source-backed knowledge your team can rely on.</p></div><label className="mt-8 block max-w-xl"><span className="sr-only">Search Playbook</span><input className="text-input" placeholder="Search approved knowledge" value={query} onChange={(event) => setQuery(event.target.value)} /></label><div className="mt-8 grid gap-4 md:grid-cols-2">{visible.map((memory) => <Link className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 transition hover:-translate-y-0.5 hover:shadow-lg" href={`/playbook/${memory.record.id}`} key={memory.record.id}><div className="flex items-center justify-between gap-3"><span className="rounded-full bg-[#eee4d8] px-3 py-1 text-xs font-bold text-[var(--accent-strong)]">{memory.record.type}</span><span className="text-xs text-[var(--muted)]">Version {memory.version.version}</span></div><h2 className="mt-5 text-xl font-semibold">{memory.version.title}</h2><p className="mt-3 line-clamp-3 leading-7 text-[var(--muted)]">{memory.version.statement}</p><p className="mt-5 text-xs font-semibold text-[var(--accent)]">Approved {new Date(memory.version.approvedAt).toLocaleDateString()}</p></Link>)}{visible.length === 0 && !status && <div className="rounded-3xl border border-dashed border-[var(--border)] p-10 text-[var(--muted)]">No approved company knowledge matches this search.</div>}</div><p className="mt-5 text-sm text-[var(--accent)]">{status}</p></main>;
}
