"use client";

import {
  AssistantRuntimeProvider,
  type AppendMessage,
  ComposerPrimitive,
  type DataMessagePartProps,
  MessagePrimitive,
  ThreadPrimitive,
  useAssistantRuntime,
  useExternalStoreRuntime,
} from "@assistant-ui/react";
import { MarkdownTextPrimitive } from "@assistant-ui/react-markdown";
import remarkGfm from "remark-gfm";
import { createContext, type ReactNode, useContext, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import type { AssistantRole, GroundedAnswer, MemoryCandidate, SourceReference } from "@/domain/types";
import { BrandMark } from "../brand-mark";
import { CandidateCard } from "../candidate-card";
import { convertMlcMessage, type MlcSopPartData, type MlcUiMessage } from "./mlc-message-adapter";

interface MlcThreadActions {
  onCandidateChanged(candidate: MemoryCandidate): void;
  onSaveSop(messageId: string): void;
}

const MlcThreadActionsContext = createContext<MlcThreadActions | null>(null);

function useMlcThreadActions(): MlcThreadActions {
  const value = useContext(MlcThreadActionsContext);
  if (!value) throw new Error("My Little Company thread actions are unavailable");
  return value;
}

function MessageText(): ReactNode {
  return <MarkdownTextPrimitive className="mlc-markdown" remarkPlugins={[remarkGfm]} smooth={false} />;
}

function MlcSourcesPart({ data }: DataMessagePartProps<SourceReference[]>): ReactNode {
  return (
    <div aria-label="Approved company sources" className="mt-4 flex flex-wrap gap-2">
      {data.map((source: SourceReference) => (
        <span className="mlc-source-chip" key={source.sourceId}>Source · {source.label}</span>
      ))}
    </div>
  );
}

function MlcKnowledgePart({ data }: DataMessagePartProps<MemoryCandidate>): ReactNode {
  const { onCandidateChanged } = useMlcThreadActions();
  return (
    <div className="mt-6" data-testid="knowledge-message-part">
      <div className="mb-3 flex items-center gap-3">
        <BrandMark className="size-8 shrink-0" />
        <div>
          <p className="text-sm font-extrabold text-[var(--cobalt-deep)]">My Little Company noticed something worth remembering.</p>
          <p className="mt-0.5 text-xs text-[var(--muted)]">Nothing becomes company knowledge until you approve it.</p>
        </div>
      </div>
      <CandidateCard candidate={data} onChanged={onCandidateChanged} />
    </div>
  );
}

function MlcSopPart({ data }: DataMessagePartProps<MlcSopPartData>): ReactNode {
  const { onSaveSop } = useMlcThreadActions();
  const { sop } = data;
  return (
    <article className="space-y-7 border border-[var(--border)] bg-white p-5 sm:p-7" data-testid="sop-draft">
      <div className="border-b-2 border-[var(--graphite)] pb-6">
        <span className="inline-flex rounded-[6px] bg-[var(--butter)] px-3 py-1.5 text-xs font-extrabold text-[var(--cobalt-deep)]">SOP DRAFT · NOT APPROVED</span>
        <h2 className="mt-4 text-4xl font-black uppercase sm:text-5xl">{sop.title}</h2>
        <p className="mt-3 max-w-3xl text-[var(--muted)]">{sop.purpose}</p>
      </div>
      <div>
        <h3 className="text-lg font-bold">Steps</h3>
        <ol className="mt-3 divide-y divide-[var(--border)] border-y border-[var(--border)]">
          {sop.steps.map((step: MlcSopPartData["sop"]["steps"][number]) => (
            <li className="flex gap-5 py-4" key={step.order}>
              <strong className="metadata flex size-9 shrink-0 items-center justify-center rounded-[6px] bg-[var(--cobalt)] text-sm text-white">{step.order}</strong>
              <span className="pt-1.5">{step.action}</span>
            </li>
          ))}
        </ol>
      </div>
      <div className="bg-[var(--cobalt-soft)] p-5">
        <h3 className="font-bold text-[var(--cobalt-deep)]">Quality checks</h3>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-[var(--graphite)]">
          {sop.qualityChecks.map((check: string) => <li key={check}>{check}</li>)}
        </ul>
      </div>
      {data.saved
        ? <p className="text-sm font-bold text-[var(--success)]">Saved for review. It is not approved yet.</p>
        : <button className="primary-button" onClick={() => onSaveSop(data.messageId)} type="button">Save for review</button>}
    </article>
  );
}

function MlcGroundedAnswerPart({ data }: DataMessagePartProps<GroundedAnswer>): ReactNode {
  return (
    <article className="overflow-hidden border border-[var(--cobalt)] bg-white" data-testid="employee-answer">
      <div className="bg-[var(--cobalt)] p-6 text-white sm:p-8">
        <p className="page-kicker text-[var(--butter)]">Approved answer</p>
        <p className="mt-3 max-w-4xl text-xl font-bold leading-8">{data.answer}</p>
      </div>
      <div className="p-6 sm:p-8">
        {data.sourceMemories.map((source: GroundedAnswer["sourceMemories"][number]) => (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] py-4 first:pt-0 last:border-b-0 last:pb-0" key={source.memoryId}>
            <strong>Source · {source.title}</strong>
            <p className="metadata text-sm text-[var(--muted)]">Approved {new Date(source.approvedAt).toLocaleDateString()}</p>
          </div>
        ))}
      </div>
    </article>
  );
}

const messagePartComponents = {
  Text: MessageText,
  data: {
    by_name: {
      "mlc-sources": MlcSourcesPart,
      "mlc-knowledge-candidate": MlcKnowledgePart,
      "mlc-sop": MlcSopPart,
      "mlc-grounded-answer": MlcGroundedAnswerPart,
    },
  },
};

function UserMessage(): ReactNode {
  return (
    <MessagePrimitive.Root className="mlc-user-message" data-role="user">
      <MessagePrimitive.Parts components={messagePartComponents} unstable_showEmptyOnNonTextEnd={false} />
    </MessagePrimitive.Root>
  );
}

function AssistantMessage(): ReactNode {
  return (
    <MessagePrimitive.Root className="mlc-assistant-message" data-role="assistant">
      <div className="mlc-assistant-avatar" aria-hidden="true"><BrandMark className="size-8" /></div>
      <div className="min-w-0 flex-1">
        <MessagePrimitive.Parts components={messagePartComponents} unstable_showEmptyOnNonTextEnd={false} />
      </div>
    </MessagePrimitive.Root>
  );
}

function DraftRestorer({ value }: { value: { text: string; requestId: number } | null }): null {
  const runtime = useAssistantRuntime();
  const restoredRequestId = useRef<number | null>(null);
  useEffect(() => {
    if (value && restoredRequestId.current !== value.requestId) {
      runtime.thread.composer.setText(value.text);
      restoredRequestId.current = value.requestId;
    }
  }, [runtime, value]);
  return null;
}

function RecoveryActions({ showModelSettings }: { showModelSettings: boolean }): ReactNode {
  const runtime = useAssistantRuntime();
  return (
    <span className="flex flex-wrap items-center gap-3">
      <button className="font-black underline" onClick={() => runtime.thread.composer.send()} type="button">Retry</button>
      {showModelSettings && <Link className="font-black underline" href="/workspace#assistant-settings">Assistant settings</Link>}
    </span>
  );
}

function Starter({ role }: { role: AssistantRole }): ReactNode {
  const runtime = useAssistantRuntime();

  const prompts: Record<AssistantRole, { kicker: string; text: string; action: string }> = {
    MARKETING: {
      kicker: "A useful first message",
      text: "Tuesdays are quiet. Create a promotion to bring more customers in.",
      action: "Use this prompt",
    },
    OPERATIONS: {
      kicker: "Approved input → repeatable work",
      text: "Create the Tuesday Promotion SOP from our approved company rules.",
      action: "Generate Tuesday Promotion SOP",
    },
    EMPLOYEE: {
      kicker: "Ask the current Playbook",
      text: "Can I give a customer 25% off?",
      action: "Use this question",
    },
  };
  const prompt = prompts[role];

  function submitStarter(): void {
    runtime.thread.composer.setText(prompt.text);
    if (role === "OPERATIONS") runtime.thread.composer.send();
  }

  return (
    <ThreadPrimitive.Empty>
      <div className="mlc-thread-starter">
        <p className="page-kicker">{prompt.kicker}</p>
        <p className="mt-2 max-w-2xl text-base leading-7 text-[var(--graphite)]">“{prompt.text}”</p>
        <button className={role === "OPERATIONS" ? "primary-button mt-5" : "secondary-button mt-5"} onClick={submitStarter} type="button">{prompt.action}</button>
      </div>
    </ThreadPrimitive.Empty>
  );
}

const roleCopy: Record<AssistantRole, { label: string; placeholder: string; send: string }> = {
  MARKETING: { label: "Message Marketing", placeholder: "Tell My Little Company what you need—or teach it something about your company.", send: "Send" },
  OPERATIONS: { label: "Message Operations", placeholder: "Ask Operations to turn approved work into repeatable steps.", send: "Send to Operations" },
  EMPLOYEE: { label: "Ask a company question", placeholder: "Can I give a customer 25% off?", send: "Ask the Playbook" },
};

export function MlcThread({
  role,
  messages,
  isRunning,
  status,
  error,
  restoreDraft,
  showModelSettings = false,
  onNew,
  onCandidateChanged,
  onSaveSop,
}: {
  role: AssistantRole;
  messages: MlcUiMessage[];
  isRunning: boolean;
  status: string;
  error: string;
  restoreDraft: { text: string; requestId: number } | null;
  showModelSettings?: boolean;
  onNew(message: AppendMessage): Promise<void>;
  onCandidateChanged(candidate: MemoryCandidate): void;
  onSaveSop(messageId: string): void;
}): ReactNode {
  const runtime = useExternalStoreRuntime<MlcUiMessage>({
    messages,
    isRunning,
    isSendDisabled: isRunning,
    convertMessage: convertMlcMessage,
    onNew,
  });
  const actions = useMemo(() => ({ onCandidateChanged, onSaveSop }), [onCandidateChanged, onSaveSop]);
  const copy = roleCopy[role];

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <MlcThreadActionsContext.Provider value={actions}>
        <DraftRestorer value={restoreDraft} />
        <ThreadPrimitive.Root className="mlc-thread-root">
          <ThreadPrimitive.Viewport className="mlc-thread-viewport">
            <Starter role={role} />
            <ThreadPrimitive.Messages components={{ UserMessage, AssistantMessage }} />
            <ThreadPrimitive.If running>
              <div className="mlc-running-state" role="status">
                <BrandMark className="size-7 animate-pulse" />
                <span>{status || "Working with the company Playbook…"}</span>
              </div>
            </ThreadPrimitive.If>
            <ThreadPrimitive.ScrollToBottom aria-label="Scroll to the latest message" className="mlc-scroll-button">↓</ThreadPrimitive.ScrollToBottom>
            <ThreadPrimitive.ViewportFooter className="mlc-composer-footer">
              <ComposerPrimitive.Root className="mlc-composer">
                <label className="sr-only" htmlFor={`mlc-composer-${role}`}>{copy.label}</label>
                <ComposerPrimitive.Input
                  aria-label={copy.label}
                  className="mlc-composer-input"
                  id={`mlc-composer-${role}`}
                  maxRows={8}
                  minRows={1}
                  placeholder={copy.placeholder}
                  submitMode="enter"
                />
                <div className="mlc-composer-actions">
                  <span>Enter to send · Shift + Enter for a new line · Type /save-knowledge to create a page</span>
                  <ComposerPrimitive.Send className="primary-button" type="button">{copy.send}</ComposerPrimitive.Send>
                </div>
              </ComposerPrimitive.Root>
              <div className={`min-h-5 px-1 pt-2 text-sm font-bold ${error ? "text-[var(--danger)]" : "text-[var(--cobalt)]"}`}>
                <p aria-live="polite">{error || (!isRunning ? status : "")}</p>
                {error && restoreDraft && <RecoveryActions showModelSettings={showModelSettings} />}
              </div>
            </ThreadPrimitive.ViewportFooter>
          </ThreadPrimitive.Viewport>
        </ThreadPrimitive.Root>
      </MlcThreadActionsContext.Provider>
    </AssistantRuntimeProvider>
  );
}
