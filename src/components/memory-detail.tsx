"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { HydratedMemory } from "@/domain/types";
import { apiRequest } from "@/lib/api";

export function MemoryDetail({ memoryId }: { memoryId: string }) {
  const [memory, setMemory] = useState<HydratedMemory | null>(null);
  const [status, setStatus] = useState("Loading company knowledge…");
  useEffect(() => { apiRequest<HydratedMemory>(`/api/memories/${memoryId}`).then((item) => { setMemory(item); setStatus(""); }).catch(() => setStatus("This Playbook entry could not be found.")); }, [memoryId]);
  if (!memory) return <main className="mx-auto max-w-4xl p-8">{status}</main>;
  return <main className="mx-auto w-full max-w-4xl px-5 py-10 sm:px-8"><Link className="text-sm font-semibold text-[var(--accent)]" href="/playbook">← Back to Playbook</Link><article className="mt-6 rounded-[2rem] border border-[var(--border)] bg-[var(--surface)] p-7 shadow-sm sm:p-10"><div className="flex flex-wrap items-center justify-between gap-3"><span className="rounded-full bg-[#eee4d8] px-3 py-1 text-xs font-bold text-[var(--accent-strong)]">{memory.record.type} · APPROVED</span><span className="text-sm text-[var(--muted)]">Version {memory.version.version} · {memory.record.indexStatus}</span></div><h1 className="mt-6 text-4xl font-semibold tracking-tight">{memory.version.title}</h1><section className="mt-8"><h2 className="text-sm font-bold tracking-wide uppercase">Company rule</h2><p className="mt-3 text-lg leading-8 text-[var(--muted)]">{memory.version.statement}</p></section><section className="mt-8 rounded-2xl bg-[#f4eee5] p-5"><h2 className="font-semibold">Why this matters</h2><p className="mt-2 leading-7 text-[var(--muted)]">{memory.version.rationale ?? "Rationale not provided."}</p></section><dl className="mt-8 grid gap-5 border-t border-[var(--border)] pt-7 text-sm sm:grid-cols-2"><div><dt className="font-semibold">Applies to</dt><dd className="mt-1 text-[var(--muted)]">{memory.version.appliesToRoles.join(" · ")}</dd></div><div><dt className="font-semibold">Approved by</dt><dd className="mt-1 text-[var(--muted)]">Maya · {new Date(memory.version.approvedAt).toLocaleString()}</dd></div><div><dt className="font-semibold">Source</dt><dd className="mt-1 text-[var(--muted)]">{memory.version.sourceRefs.map((source) => source.label).join(", ")}</dd></div><div><dt className="font-semibold">Status</dt><dd className="mt-1 text-[var(--muted)]">Current company truth</dd></div></dl></article></main>;
}
