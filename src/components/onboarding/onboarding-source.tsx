"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ChatGptConversationPreview } from "@/domain/chatgpt-export";
import { apiRequest } from "@/lib/api";
import type { OnboardingSessionView } from "./onboarding-types";

type SourceMode = "PASTE" | "CHATGPT";

export function OnboardingSource({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const workerRef = useRef<Worker | null>(null);
  const [mode, setMode] = useState<SourceMode>("PASTE");
  const [title, setTitle] = useState("Owner context");
  const [content, setContent] = useState("");
  const [conversations, setConversations] = useState<ChatGptConversationPreview[]>([]);
  const [selected, setSelected] = useState<ChatGptConversationPreview | null>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => () => workerRef.current?.terminate(), []);

  async function readExport(file: File): Promise<void> {
    if (file.size > 20 * 1024 * 1024) {
      setStatus("That export is larger than 20 MB. Extract a smaller conversations.json or paste the relevant context.");
      return;
    }
    setStatus("Reading conversation titles on this device…");
    const text = await file.text();
    const worker = new Worker(new URL("../../workers/chatgpt-export.worker.ts", import.meta.url));
    workerRef.current?.terminate();
    workerRef.current = worker;
    worker.onmessage = (event: MessageEvent<{ ok: boolean; conversations?: ChatGptConversationPreview[]; error?: string }>) => {
      if (!event.data.ok) {
        setStatus("This does not look like a supported ChatGPT conversations.json export.");
        return;
      }
      const items = event.data.conversations ?? [];
      setConversations(items);
      setSelected(items[0] ?? null);
      setStatus(items.length ? `Found ${items.length} conversations. Only the one you choose will be uploaded.` : "No conversations with user and assistant messages were found.");
    };
    worker.postMessage({ text });
  }

  async function processToCompletion(batchId: string): Promise<OnboardingSessionView> {
    let latest: OnboardingSessionView | null = null;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      latest = await apiRequest<OnboardingSessionView>(`/api/imports/${batchId}/process`, { method: "POST" });
      if (latest.batch?.state === "COMPLETED") return latest;
      if (latest.batch?.state === "FAILED") throw new Error("We could not organize this context. Your selection is preserved so you can retry.");
      await new Promise((resolve) => window.setTimeout(resolve, Math.min(4000, 1000 * 2 ** attempt)));
    }
    throw new Error("This is taking longer than expected. You can safely return and continue setup.");
  }

  async function submit(): Promise<void> {
    const selectedContent = mode === "PASTE" ? content.trim() : selected?.content ?? "";
    const selectedTitle = mode === "PASTE" ? title.trim() : selected?.title ?? "ChatGPT conversation";
    if (!selectedContent) return;
    setBusy(true);
    setStatus("Reading the context you chose…");
    try {
      const view = await apiRequest<OnboardingSessionView>("/api/imports", {
        method: "POST",
        body: JSON.stringify({
          sessionId,
          provider: mode,
          title: selectedTitle,
          content: selectedContent,
          externalId: mode === "CHATGPT" ? selected?.id : undefined,
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      if (!view.batch) throw new Error("The import did not start.");
      const completed = await processToCompletion(view.batch.id);
      if (completed.candidates.length === 0) {
        setStatus("We did not find durable company knowledge in that context. Try a source containing a rule, customer insight, brand choice, or repeatable process.");
        setBusy(false);
        return;
      }
      router.push(`/onboarding/review/${sessionId}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not process this context.");
      setBusy(false);
    }
  }

  const selectedContent = mode === "PASTE" ? content.trim() : selected?.content ?? "";

  return (
    <main className="onboarding-page">
      <section className="onboarding-panel onboarding-panel-wide">
        <p className="page-kicker">Bring your company with you</p>
        <p className="onboarding-progress">Step 2 of 4 · Choose context</p>
        <h1>Where is the useful context today?</h1>
        <p className="onboarding-lede">Start with one conversation. Imported text stays a source; nothing becomes company truth until you approve it.</p>
        <div className="onboarding-source-tabs" role="tablist" aria-label="Context source">
          <button aria-selected={mode === "PASTE"} onClick={() => setMode("PASTE")} role="tab" type="button">Paste text</button>
          <button aria-selected={mode === "CHATGPT"} onClick={() => setMode("CHATGPT")} role="tab" type="button">ChatGPT export</button>
        </div>
        {mode === "PASTE" ? (
          <div className="onboarding-source-form" key="paste">
            <label className="field-label">Source title<input className="text-input" maxLength={200} onChange={(event) => setTitle(event.target.value)} value={title} /></label>
            <label className="field-label">Paste the useful conversation or notes<textarea className="text-input min-h-64" maxLength={40_000} onChange={(event) => setContent(event.target.value)} placeholder="Paste the conversation that contains company rules, decisions, customer insights, or how work gets done." value={content} /></label>
            <small>{content.length.toLocaleString()} / 40,000 characters</small>
          </div>
        ) : (
          <div className="onboarding-source-form" key="chatgpt">
            <label className="onboarding-file-picker">Choose extracted conversations.json
              <input accept="application/json,.json" onChange={(event) => { const file = event.target.files?.[0]; if (file) void readExport(file); }} type="file" />
              <span>The file is read on this device. Only your selected conversation is uploaded.</span>
            </label>
            {conversations.length > 0 && <label className="field-label">Conversation
              <select className="text-input" onChange={(event) => setSelected(conversations.find((item) => item.id === event.target.value) ?? null)} value={selected?.id ?? ""}>
                {conversations.map((conversation) => <option key={conversation.id} value={conversation.id}>{conversation.title} · {conversation.messageCount} messages</option>)}
              </select>
            </label>}
            {selected?.truncated && <p className="onboarding-notice">This conversation is long. Quick setup will use its most recent 40,000 characters.</p>}
          </div>
        )}
        <div className="onboarding-actions">
          <button className="primary-button" disabled={busy || !selectedContent} onClick={() => void submit()} type="button">Use this context <span aria-hidden="true">→</span></button>
          <button className="quiet-button" disabled={busy} onClick={() => router.push("/workspace")} type="button">Save and continue later</button>
        </div>
        <p aria-live="polite" className="onboarding-status">{status}</p>
      </section>
    </main>
  );
}
