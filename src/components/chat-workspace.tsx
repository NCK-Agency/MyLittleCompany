"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import type { AssistantRole, GroundedAnswer, MemoryCandidate, Message, SopDraft } from "@/domain/types";
import { apiRequest } from "@/lib/api";
import { CandidateCard } from "./candidate-card";

const assistants: Array<{ role: AssistantRole; label: string; description: string }> = [
  { role: "MARKETING", label: "Marketing", description: "Ideas grounded in your brand and decisions" },
  { role: "OPERATIONS", label: "Operations", description: "Turn approved work into repeatable steps" },
  { role: "EMPLOYEE", label: "Employee", description: "Ask the current company Playbook" },
];

export function ChatWorkspace() {
  const searchParams = useSearchParams();
  const requested = searchParams.get("assistant") as AssistantRole | null;
  const [role, setRole] = useState<AssistantRole>(requested && assistants.some((item) => item.role === requested) ? requested : "MARKETING");
  const [conversationId, setConversationId] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [candidate, setCandidate] = useState<MemoryCandidate | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [sop, setSop] = useState<SopDraft | null>(null);
  const [sopSaved, setSopSaved] = useState(false);
  const [answer, setAnswer] = useState<GroundedAnswer | null>(null);

  function selectRole(nextRole: AssistantRole): void {
    setRole(nextRole);
    setConversationId("");
    setMessages([]);
    setCandidate(null);
    setStatus("");
    setSop(null);
    setSopSaved(false);
    setAnswer(null);
    setDraft("");
  }

  async function ensureConversation(): Promise<string> {
    if (conversationId) return conversationId;
    const conversation = await apiRequest<{ id: string }>("/api/conversations", {
      method: "POST",
      body: JSON.stringify({ assistantRole: role, title: role === "MARKETING" ? "Tuesday promotion" : `${role} conversation` }),
    });
    setConversationId(conversation.id);
    return conversation.id;
  }

  async function sendMarketing(): Promise<void> {
    if (!draft.trim() || busy) return;
    const content = draft;
    setBusy(true); setStatus("Checking the company Playbook…");
    try {
      const id = await ensureConversation();
      const result = await apiRequest<{ ownerMessage: Message; assistantMessage: Message | null; suggestedKnowledge: MemoryCandidate[] }>(`/api/conversations/${id}/messages`, {
        method: "POST",
        body: JSON.stringify({ content, idempotencyKey: crypto.randomUUID() }),
      });
      setMessages((current) => [...current, result.ownerMessage, ...(result.assistantMessage ? [result.assistantMessage] : [])]);
      if (result.suggestedKnowledge[0]) setCandidate(result.suggestedKnowledge[0]);
      setDraft(""); setStatus("");
    } catch (error) { setStatus(error instanceof Error ? error.message : "Could not send the message. Your draft is preserved."); }
    finally { setBusy(false); }
  }

  async function generateSop(saveAsSuggestion = false): Promise<void> {
    setBusy(true); setStatus(saveAsSuggestion ? "Saving as suggested company knowledge…" : "Creating the Tuesday Promotion SOP…");
    try {
      const result = await apiRequest<{ sop: SopDraft; candidate?: MemoryCandidate }>("/api/sops/generate", {
        method: "POST", body: JSON.stringify({ saveAsSuggestion }),
      });
      setSop(result.sop); setSopSaved(Boolean(result.candidate)); setStatus(result.candidate ? "Saved for review. It is not approved yet." : "SOP draft ready.");
    } catch (error) { setStatus(error instanceof Error ? error.message : "Could not create the SOP."); }
    finally { setBusy(false); }
  }

  async function askEmployee(): Promise<void> {
    if (!draft.trim()) return;
    setBusy(true); setStatus("Finding relevant company knowledge…");
    try {
      setAnswer(await apiRequest<GroundedAnswer>("/api/employee/answer", { method: "POST", body: JSON.stringify({ question: draft }) }));
      setDraft(""); setStatus("");
    } catch (error) { setStatus(error instanceof Error ? error.message : "Could not find an answer."); }
    finally { setBusy(false); }
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8">
      <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
        <aside className="h-fit rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-3">
          <p className="px-3 py-2 text-xs font-bold tracking-wider text-[var(--muted)] uppercase">Choose an assistant</p>
          {assistants.map((assistant) => <button className={`mt-1 w-full rounded-2xl p-3 text-left ${role === assistant.role ? "bg-[#eee4d8]" : "hover:bg-[#f4eee5]"}`} key={assistant.role} onClick={() => selectRole(assistant.role)} type="button"><strong className="block text-sm">{assistant.label}</strong><span className="mt-1 block text-xs leading-5 text-[var(--muted)]">{assistant.description}</span></button>)}
        </aside>
        <section className="min-h-[70vh] overflow-hidden rounded-[2rem] border border-[var(--border)] bg-[var(--surface)] shadow-[0_24px_70px_rgb(67_49_35/8%)]">
          <header className="border-b border-[var(--border)] px-6 py-5 sm:px-8"><p className="text-xs font-bold tracking-wider text-[var(--accent)] uppercase">{role} ASSISTANT</p><h1 className="mt-2 text-2xl font-semibold">{role === "MARKETING" ? "Create work that remembers your rules" : role === "OPERATIONS" ? "Make the Tuesday promotion repeatable" : "Ask the company Playbook"}</h1></header>
          <div className="space-y-5 p-6 sm:p-8">
            {role === "MARKETING" && <>
              {messages.length === 0 && <div className="rounded-2xl bg-[#f4eee5] p-5 text-sm leading-6 text-[var(--muted)]">Try: “Tuesdays are quiet. Create a promotion to bring more customers in.”</div>}
              {messages.map((message) => <article className={`max-w-3xl rounded-2xl p-5 ${message.actorType === "USER" ? "ml-auto bg-[var(--accent)] text-white" : "bg-[#f3eee6]"}`} key={message.id}><p className="whitespace-pre-line leading-7">{message.content}</p>{message.sourceRefs.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{message.sourceRefs.map((source) => <span className="rounded-full border border-[#d5c8b8] bg-white px-3 py-1 text-xs font-semibold text-[var(--accent-strong)]" key={source.sourceId}>Source · {source.label}</span>)}</div>}</article>)}
              {candidate && <CandidateCard candidate={candidate} onChanged={setCandidate} />}
              <label className="field-label">Message Marketing<textarea className="text-input min-h-28" placeholder="Tell MLC what you need—or teach it something about your company." value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendMarketing(); } }} /></label>
              <button className="primary-button" disabled={busy || !draft.trim()} onClick={() => void sendMarketing()} type="button">Send</button>
            </>}
            {role === "OPERATIONS" && <>
              {!sop && <div className="rounded-2xl bg-[#f4eee5] p-6"><p className="leading-7 text-[var(--muted)]">Once the pricing decision is approved, Operations can turn it into clear front-desk steps.</p><button className="primary-button mt-5" disabled={busy} onClick={() => void generateSop()} type="button">Generate Tuesday Promotion SOP</button></div>}
              {sop && <article className="space-y-6" data-testid="sop-draft"><div><span className="rounded-full bg-[#eee0cf] px-3 py-1 text-xs font-bold text-[var(--accent-strong)]">SOP DRAFT · NOT APPROVED</span><h2 className="mt-4 text-3xl font-semibold">{sop.title}</h2><p className="mt-3 text-[var(--muted)]">{sop.purpose}</p></div><div><h3 className="font-semibold">Steps</h3><ol className="mt-3 space-y-3">{sop.steps.map((step) => <li className="flex gap-4 rounded-2xl bg-[#f4eee5] p-4" key={step.order}><strong>{step.order}</strong><span>{step.action}</span></li>)}</ol></div><div><h3 className="font-semibold">Quality checks</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-[var(--muted)]">{sop.qualityChecks.map((check) => <li key={check}>{check}</li>)}</ul></div>{!sopSaved && <button className="primary-button" disabled={busy} onClick={() => void generateSop(true)} type="button">Save for review</button>}</article>}
            </>}
            {role === "EMPLOYEE" && <>
              <label className="field-label">Ask a company question<input className="text-input" placeholder="Can I give a customer 25% off?" value={draft} onChange={(event) => setDraft(event.target.value)} /></label>
              <button className="primary-button" disabled={busy || !draft.trim()} onClick={() => void askEmployee()} type="button">Ask the Playbook</button>
              {answer && <article className="rounded-3xl bg-[#f3eee6] p-6" data-testid="employee-answer"><p className="text-xl font-semibold leading-8">{answer.answer}</p>{answer.sourceMemories.map((source) => <div className="mt-5 rounded-2xl bg-white p-4 text-sm" key={source.memoryId}><strong>Source · {source.title}</strong><p className="mt-1 text-[var(--muted)]">Approved {new Date(source.approvedAt).toLocaleDateString()}</p></div>)}</article>}
            </>}
            <p aria-live="polite" className="text-sm font-medium text-[var(--accent)]">{status}</p>
          </div>
        </section>
      </div>
    </main>
  );
}
