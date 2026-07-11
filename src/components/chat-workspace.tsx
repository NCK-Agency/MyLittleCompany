"use client";

import type { AppendMessage } from "@assistant-ui/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  AssistantRole,
  Company,
  Conversation,
  GroundedAnswer,
  HydratedMemory,
  KnowledgeScope,
  MemoryCandidate,
  Message,
  SopDraft,
} from "@/domain/types";
import { apiRequest } from "@/lib/api";
import { BrandMark } from "./brand-mark";
import { useViewer } from "./viewer-context";
import { canAccess, isOwner } from "@/domain/authorization";
import { SignOutButton } from "./sign-out-button";
import { readComposerText, type MlcUiMessage } from "./assistant-ui/mlc-message-adapter";
import { MlcThread } from "./assistant-ui/mlc-thread";
import { KnowledgePageDialog } from "./knowledge-page-dialog";

const assistants: Array<{ role: AssistantRole; label: string; description: string }> = [
  { role: "MARKETING", label: "Marketing", description: "Campaigns and brand work" },
  { role: "OPERATIONS", label: "Operations", description: "Procedures and repeatable work" },
  { role: "EMPLOYEE", label: "Employee", description: "Answers from approved knowledge" },
];

function newUiId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function fromDomainMessage(message: Message): MlcUiMessage {
  return {
    id: message.id,
    role: message.actorType === "USER" ? "user" : "assistant",
    createdAt: message.createdAt,
    text: message.content,
    sources: message.sourceRefs,
  };
}

function defaultTitle(content: string): string {
  const compact = content.replaceAll(/\s+/g, " ").trim();
  if (!compact) return "New conversation";
  return compact.length > 54 ? `${compact.slice(0, 51).trim()}…` : compact;
}

function roleLabel(role: AssistantRole): string {
  return assistants.find((assistant) => assistant.role === role)?.label ?? role;
}

export function ChatWorkspace() {
  const viewer = useViewer();
  const owner = Boolean(viewer && isOwner(viewer));
  const canReview = owner || Boolean(viewer?.grants.some((grant) => grant.permission === "APPROVE"));
  const canRead = owner || Boolean(viewer?.grants.some((grant) => grant.permission === "READ" || grant.permission === "APPROVE"));
  const suggestionScopes = owner ? [{ level: "COMPANY" } as const] : viewer?.grants
    .filter((grant) => grant.permission === "SUGGEST")
    .map((grant) => grant.scope) ?? [];
  const searchParams = useSearchParams();
  const requested = searchParams.get("assistant") as AssistantRole | null;
  const requestedConversationId = searchParams.get("conversation");
  const initialRole = requested && assistants.some((item) => item.role === requested) ? requested : "MARKETING";
  const [company, setCompany] = useState<Company | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [role, setRole] = useState<AssistantRole>(initialRole);
  const [scope, setScope] = useState<KnowledgeScope>({ level: "COMPANY" });
  const [messages, setMessages] = useState<MlcUiMessage[]>([]);
  const [sourceMessages, setSourceMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [restoreDraft, setRestoreDraft] = useState<{ text: string; requestId: number } | null>(null);
  const [query, setQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveStatement, setSaveStatement] = useState("");
  const [savedMemory, setSavedMemory] = useState<HydratedMemory | null>(null);
  const [approvedMemories, setApprovedMemories] = useState<HydratedMemory[]>([]);
  const [knowledgePanelOpen, setKnowledgePanelOpen] = useState(false);
  const [workspaceReady, setWorkspaceReady] = useState(false);
  const openedRequestedConversationId = useRef<string | null>(null);

  const loadConversations = useCallback(async (): Promise<void> => {
    const items = await apiRequest<Conversation[]>("/api/conversations");
    setConversations(items);
  }, []);

  const loadKnowledge = useCallback(async (): Promise<void> => {
    if (!canRead) {
      setApprovedMemories([]);
      return;
    }
    const items = await apiRequest<HydratedMemory[]>("/api/memories");
    setApprovedMemories(items);
  }, [canRead]);

  useEffect(() => {
    Promise.all([
      apiRequest<Company>("/api/company"),
      apiRequest<Conversation[]>("/api/conversations"),
      canRead ? apiRequest<HydratedMemory[]>("/api/memories") : Promise.resolve([]),
    ]).then(([companyResult, conversationResult, memoryResult]) => {
      setCompany(companyResult);
      setConversations(conversationResult);
      setApprovedMemories(memoryResult);
    }).catch(() => setError("Could not open the conversation workspace."))
      .finally(() => setWorkspaceReady(true));
  }, [canRead]);

  const visibleConversations = useMemo(() => conversations.filter((conversation) =>
    `${conversation.title} ${roleLabel(conversation.assistantRole)}`.toLowerCase().includes(query.toLowerCase())), [conversations, query]);

  const usedMemoryIds = useMemo(() => new Set(messages.flatMap((message) =>
    (message.sources ?? []).map((source) => source.sourceId))), [messages]);
  const usedMemories = useMemo(() => approvedMemories.filter((memory) => usedMemoryIds.has(memory.record.id)), [approvedMemories, usedMemoryIds]);
  const recentMemories = useMemo(() => approvedMemories.filter((memory) => (
    memory.record.scope.level === "COMPANY"
      ? scope.level === "COMPANY" || scope.level === "DEPARTMENT"
      : scope.level === "DEPARTMENT" && memory.record.scope.organizationalUnitId === scope.organizationalUnitId
  )).slice(0, 5), [approvedMemories, scope]);
  const pendingSuggestions = useMemo(() => messages.flatMap((message) => message.candidate ? [message.candidate] : [])
    .filter((candidate) => candidate.status === "PROPOSED" || candidate.status === "APPROVING"), [messages]);

  function startNew(nextRole: AssistantRole = role): void {
    setActiveConversation(null);
    setRole(nextRole);
    setScope({ level: "COMPANY" });
    setMessages([]);
    setSourceMessages([]);
    setError("");
    setStatus("");
    setRestoreDraft(null);
    setSidebarOpen(false);
    setKnowledgePanelOpen(false);
  }

  const openConversation = useCallback(async (conversation: Conversation): Promise<void> => {
    setBusy(true);
    setError("");
    setStatus("Opening conversation…");
    try {
      const [loaded, candidates] = await Promise.all([
        apiRequest<Message[]>(`/api/conversations/${conversation.id}/messages`),
        canReview ? apiRequest<MemoryCandidate[]>("/api/memory-candidates") : Promise.resolve([]),
      ]);
      const converted = loaded.map(fromDomainMessage);
      for (const candidate of candidates.filter((item) => item.conversationId === conversation.id)) {
        const sourceIndex = loaded.findIndex((message) => candidate.sourceRefs.some((source) => source.messageId === message.id));
        const assistantIndex = loaded.findIndex((message, index) => index > sourceIndex && message.actorType === "ASSISTANT");
        if (assistantIndex >= 0) converted[assistantIndex] = { ...converted[assistantIndex], candidate };
      }
      setActiveConversation(conversation);
      setRole(conversation.assistantRole);
      setScope(conversation.scope);
      setSourceMessages(loaded);
      setMessages(converted);
      setStatus("");
      setSidebarOpen(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not open this conversation.");
      setStatus("");
    } finally {
      setBusy(false);
    }
  }, [canReview]);

  useEffect(() => {
    if (!workspaceReady || !requestedConversationId || openedRequestedConversationId.current === requestedConversationId) return;
    openedRequestedConversationId.current = requestedConversationId;
    const task = window.setTimeout(() => {
      const requestedConversation = conversations.find((conversation) => conversation.id === requestedConversationId);
      if (requestedConversation) {
        void openConversation(requestedConversation);
      } else {
        setError("That conversation is not available to this account.");
      }
    }, 0);
    return () => window.clearTimeout(task);
  }, [conversations, openConversation, requestedConversationId, workspaceReady]);

  async function ensureConversation(content: string): Promise<Conversation> {
    if (activeConversation) return activeConversation;
    const created = await apiRequest<Conversation>("/api/conversations", {
      method: "POST",
      body: JSON.stringify({ assistantRole: role, title: defaultTitle(content), scope }),
    });
    setActiveConversation(created);
    setConversations((current) => [created, ...current]);
    return created;
  }

  function openSaveCommand(content: string): void {
    const commandBody = content.replace(/^\/save-knowledge\b/i, "").trim();
    const lastOwnerMessage = [...sourceMessages].reverse().find((message) => message.actorType === "USER");
    setSaveStatement(commandBody || lastOwnerMessage?.content || "");
    setSaveDialogOpen(true);
    setError("");
    setStatus(owner ? "Review the page before saving it as approved knowledge." : "Review the suggestion before sending it for approval.");
  }

  async function handleNew(message: AppendMessage): Promise<void> {
    const content = readComposerText(message.content);
    if (!content || busy) return;
    if (/^\/save-knowledge\b/i.test(content)) {
      if (!owner && (!viewer || !canAccess(viewer, "SUGGEST", scope))) {
        setError("You do not have permission to suggest knowledge for this scope.");
        return;
      }
      openSaveCommand(content);
      return;
    }

    const optimisticId = newUiId("local-user");
    setMessages((current) => [...current, {
      id: optimisticId,
      role: "user",
      createdAt: new Date().toISOString(),
      text: content,
    }]);
    setBusy(true);
    setError("");
    setRestoreDraft(null);
    setStatus(role === "EMPLOYEE" ? "Finding approved company knowledge…" : "Working with the Company Playbook…");

    try {
      const conversation = await ensureConversation(content);
      const result = await apiRequest<{
        ownerMessage: Message;
        assistantMessage: Message | null;
        suggestedKnowledge: MemoryCandidate[];
        sop?: SopDraft;
        groundedAnswer?: GroundedAnswer;
      }>(`/api/conversations/${conversation.id}/messages`, {
        method: "POST",
        body: JSON.stringify({ content, idempotencyKey: crypto.randomUUID() }),
      });
      const candidate = result.suggestedKnowledge[0];
      const assistantUiMessage = result.assistantMessage ? {
        ...fromDomainMessage(result.assistantMessage),
        candidate,
        sop: result.sop,
        sopSaved: false,
        groundedAnswer: result.groundedAnswer,
      } : null;
      setSourceMessages((current) => [
        ...current,
        result.ownerMessage,
        ...(result.assistantMessage ? [result.assistantMessage] : []),
      ]);
      setMessages((current) => [
        ...current.filter((item) => item.id !== optimisticId),
        fromDomainMessage(result.ownerMessage),
        ...(assistantUiMessage ? [assistantUiMessage] : []),
      ]);
      await loadConversations();
      setStatus("");
    } catch (caught) {
      setMessages((current) => current.filter((item) => item.id !== optimisticId));
      setError(caught instanceof Error ? caught.message : "The message could not be sent. Your draft was restored.");
      setStatus("");
      setRestoreDraft({ text: content, requestId: Date.now() });
    } finally {
      setBusy(false);
    }
  }

  const handleCandidateChanged = useCallback((candidate: MemoryCandidate): void => {
    setMessages((current) => current.map((message) => (
      message.candidate?.id === candidate.id ? { ...message, candidate } : message
    )));
    if (candidate.status === "APPROVED") void loadKnowledge();
  }, [loadKnowledge]);

  const handleSaveSop = useCallback(async (messageId: string): Promise<void> => {
    if (busy) return;
    setBusy(true);
    setError("");
    setStatus("Saving as suggested company knowledge…");
    try {
      const assistantIndex = messages.findIndex((message) => message.id === messageId);
      const request = messages.slice(0, assistantIndex).reverse().find((message) => message.role === "user")?.text
        ?? "Create an SOP from our approved company rules.";
      const result = await apiRequest<{ sop: SopDraft; candidate?: MemoryCandidate }>("/api/sops/generate", {
        method: "POST",
        body: JSON.stringify({ saveAsSuggestion: true, request, scope: activeConversation?.scope ?? scope }),
      });
      setMessages((current) => current.map((message) => (
        message.id === messageId
          ? { ...message, sop: result.sop, sopSaved: true, candidate: result.candidate }
          : message
      )));
      setStatus("Saved for review. It is not approved yet.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save the procedure for review.");
      setStatus("");
    } finally {
      setBusy(false);
    }
  }, [activeConversation, busy, messages, scope]);

  const currentScopeLabel = scope.level === "COMPANY"
    ? "Entire company"
    : company?.organizationalUnits.find((unit) => unit.id === scope.organizationalUnitId)?.name ?? "Department";

  function toggleKnowledgePanel(): void {
    const opening = !knowledgePanelOpen;
    setKnowledgePanelOpen(opening);
    if (opening) void loadKnowledge();
  }

  return (
    <main className="conversation-workspace">
      <button
        aria-expanded={sidebarOpen}
        aria-label="Open conversation history"
        className="chat-mobile-menu"
        onClick={() => setSidebarOpen((current) => !current)}
        type="button"
      >☰</button>

      <aside className="conversation-sidebar" data-open={sidebarOpen}>
        <Link className="workspace-brand" href="/">
          <BrandMark className="size-9" />
          <span><strong>My Little</strong><strong>Company</strong></span>
        </Link>

        <button className="new-conversation-button" onClick={() => startNew()} type="button">
          <span aria-hidden="true">＋</span> New conversation
        </button>

        <label className="conversation-search">
          <span className="sr-only">Search conversations</span>
          <input onChange={(event) => setQuery(event.target.value)} placeholder="Search conversations" type="search" value={query} />
        </label>

        <div className="assistant-shortcuts" aria-label="Start with an assistant">
          {assistants.map((assistant) => (
            <button key={assistant.role} onClick={() => startNew(assistant.role)} type="button">
              <span>{assistant.label}</span>
              <small>{assistant.description}</small>
            </button>
          ))}
        </div>

        <div className="conversation-history">
          <p className="sidebar-section-label">Previous conversations</p>
          {visibleConversations.map((conversation) => (
            <button
              aria-current={activeConversation?.id === conversation.id ? "page" : undefined}
              className="conversation-history-item"
              key={conversation.id}
              onClick={() => void openConversation(conversation)}
              type="button"
            >
              <span>{conversation.title}</span>
              <small>{roleLabel(conversation.assistantRole)} · {conversation.scope.level === "COMPANY" ? "Company" : "Department"}</small>
            </button>
          ))}
          {!visibleConversations.length && <p className="conversation-empty">Your conversations will appear here.</p>}
        </div>

        <nav aria-label="Workspace navigation" className="workspace-sidebar-nav">
          <Link aria-current="page" href="/chat">Chat</Link>
          {canReview && <Link href="/review">Review</Link>}
          {canRead && <Link href="/playbook">Knowledge</Link>}
          <Link href="/workspace">Company</Link>
          <SignOutButton />
        </nav>
      </aside>

      {sidebarOpen && <button aria-label="Close conversation history" className="conversation-sidebar-scrim" onClick={() => setSidebarOpen(false)} type="button" />}

      <section className="conversation-main">
        <header className="conversation-header">
          <div className="conversation-title-block">
            <p>{activeConversation ? "Conversation" : "New conversation"}</p>
            <h1>{activeConversation?.title ?? `${roleLabel(role)} Assistant`}</h1>
          </div>
          <div className="conversation-controls">
            <label>
              <span>Assistant</span>
              <select
                disabled={Boolean(activeConversation)}
                onChange={(event) => startNew(event.target.value as AssistantRole)}
                value={role}
              >
                {assistants.map((assistant) => <option key={assistant.role} value={assistant.role}>{assistant.label}</option>)}
              </select>
            </label>
            <label>
              <span>Knowledge scope</span>
              <select
                disabled={Boolean(activeConversation)}
                onChange={(event) => setScope(event.target.value === "COMPANY"
                  ? { level: "COMPANY" }
                  : { level: "DEPARTMENT", organizationalUnitId: event.target.value })}
                value={scope.level === "COMPANY" ? "COMPANY" : scope.organizationalUnitId}
              >
                <option value="COMPANY">Entire company</option>
                {company?.organizationalUnits
                  .filter((unit) => unit.type === "DEPARTMENT")
                  .map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
              </select>
            </label>
          </div>
        </header>

        <div className="conversation-trust-bar">
          <span>Using approved knowledge from <strong>{currentScopeLabel}</strong></span>
          <div className="conversation-trust-actions">
            <button aria-expanded={knowledgePanelOpen} className="knowledge-context-button" onClick={toggleKnowledgePanel} type="button">
              Context {usedMemories.length ? `· ${usedMemories.length} used` : ""}
            </button>
            {(owner || (viewer && canAccess(viewer, "SUGGEST", scope))) && <button onClick={() => openSaveCommand("/save-knowledge")} type="button">/save-knowledge</button>}
          </div>
        </div>

        {savedMemory && (
          <div className="knowledge-saved-banner" role="status">
            <span>Saved “{savedMemory.version.title}” to Knowledge.</span>
            <Link href={`/playbook/${savedMemory.record.id}`}>Open page →</Link>
          </div>
        )}

        <div className="conversation-thread">
          {workspaceReady ? <MlcThread
            error={error}
            isRunning={busy}
            messages={messages}
            onCandidateChanged={handleCandidateChanged}
            onNew={handleNew}
            onSaveSop={(messageId) => void handleSaveSop(messageId)}
            restoreDraft={restoreDraft}
            role={role}
            status={status}
          /> : <p aria-live="polite" className="onboarding-status" role="status">Opening your company workspace…</p>}
        </div>
      </section>

      {knowledgePanelOpen && <aside aria-label="Conversation knowledge" className="conversation-knowledge-panel" data-open="true">
        <header>
          <div>
            <p className="page-kicker">Trusted context</p>
            <h2>Conversation knowledge</h2>
          </div>
          <button aria-label="Close conversation knowledge" className="icon-button" onClick={() => setKnowledgePanelOpen(false)} type="button">×</button>
        </header>

        <div className="conversation-knowledge-content">
          <section>
            <div className="conversation-knowledge-section-heading">
              <h3>Used in this conversation</h3>
              <span>{usedMemories.length}</span>
            </div>
            {usedMemories.length ? usedMemories.map((memory) => (
              <Link className="conversation-knowledge-link" href={`/playbook/${memory.record.id}`} key={memory.record.id}>
                <strong>{memory.version.title}</strong>
                <span>{memory.version.statement}</span>
              </Link>
            )) : <p className="conversation-context-empty">Approved sources used by assistant answers will appear here.</p>}
          </section>

          <section>
            <div className="conversation-knowledge-section-heading">
              <h3>Available in {currentScopeLabel}</h3>
              <span>{recentMemories.length}</span>
            </div>
            {recentMemories.length ? recentMemories.map((memory) => (
              <Link className="conversation-knowledge-link" href={`/playbook/${memory.record.id}`} key={memory.record.id}>
                <strong>{memory.version.title}</strong>
                <span>{memory.record.type.replaceAll("_", " ").toLowerCase()}</span>
              </Link>
            )) : <p className="conversation-context-empty">No approved knowledge is available for this scope yet.</p>}
          </section>

          <section>
            <div className="conversation-knowledge-section-heading">
              <h3>Waiting for review</h3>
              <span>{pendingSuggestions.length}</span>
            </div>
            {pendingSuggestions.length ? pendingSuggestions.map((candidate) => (
              <Link className="conversation-knowledge-link" href="/review" key={candidate.id}>
                <strong>{candidate.title}</strong>
                <span>Suggested knowledge · owner decision needed</span>
              </Link>
            )) : <p className="conversation-context-empty">Nothing from this conversation is waiting for approval.</p>}
          </section>
        </div>

        <footer>
          <Link href="/playbook">Open all company knowledge →</Link>
        </footer>
      </aside>}

      {saveDialogOpen && <KnowledgePageDialog
        allowedScopes={owner ? undefined : suggestionScopes}
        company={company}
        conversation={activeConversation}
        initialScope={scope}
        initialStatement={saveStatement}
        messages={sourceMessages}
        mode={owner ? "approved" : "suggestion"}
        onClose={() => setSaveDialogOpen(false)}
        onSaved={(memory) => {
          setSavedMemory(memory);
          setApprovedMemories((current) => [memory, ...current.filter((item) => item.record.id !== memory.record.id)]);
          setSaveDialogOpen(false);
          setStatus("Saved as approved company knowledge.");
        }}
        onSuggested={() => {
          setSaveDialogOpen(false);
          setStatus("Suggestion sent for review.");
        }}
      />}
    </main>
  );
}
