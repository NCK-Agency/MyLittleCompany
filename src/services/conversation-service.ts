import { createConversationSchema, sendMessageSchema } from "@/domain/schemas";
import { canAccess, isOwner } from "@/domain/authorization";
import { appError } from "@/domain/errors";
import type { ActorContext, Conversation, GroundedAnswer, MemoryCandidate, Message, SopDraft } from "@/domain/types";
import type { ConversationRepository } from "@/ports/conversation-repository";
import type { ModelGateway } from "@/ports/model-gateway";
import type { SourceRepository } from "@/ports/source-repository";
import type { ConnectedSuggestionService } from "./connected-suggestion-service";
import type { MemoryRetrievalService } from "./memory-retrieval-service";

export class ConversationService {
  constructor(
    private readonly conversations: ConversationRepository,
    private readonly retrieval: MemoryRetrievalService,
    private readonly model: ModelGateway,
    private readonly sources: SourceRepository,
    private readonly suggestions: ConnectedSuggestionService,
  ) {}

  async create(input: unknown, actor: ActorContext): Promise<Conversation> {
    const values = createConversationSchema.parse(input);
    if (!canAccess(actor, "READ", values.scope) && !canAccess(actor, "SUGGEST", values.scope)) {
      throw appError("FORBIDDEN");
    }
    const now = new Date().toISOString();
    return this.conversations.create({
      id: `conversation-${crypto.randomUUID()}`,
      companyId: actor.companyId,
      title: values.title,
      assistantRole: values.assistantRole,
      scope: values.scope,
      createdBy: actor.userId,
      createdAt: now,
      updatedAt: now,
    });
  }

  async list(actor: ActorContext): Promise<Conversation[]> {
    return (await this.conversations.list(actor.companyId)).filter((conversation) =>
      (isOwner(actor) || conversation.createdBy === actor.userId)
      && (canAccess(actor, "READ", conversation.scope) || canAccess(actor, "SUGGEST", conversation.scope)));
  }

  async listMessages(conversationId: string, actor: ActorContext): Promise<Message[]> {
    const conversation = await this.conversations.get(conversationId, actor.companyId);
    if (!conversation) throw appError("NOT_FOUND");
    this.assertConversationAccess(conversation, actor);
    return this.conversations.listMessages(conversationId, actor.companyId);
  }

  async send(conversationId: string, input: unknown, actor: ActorContext): Promise<{
    ownerMessage: Message;
    assistantMessage: Message | null;
    suggestedKnowledge: MemoryCandidate[];
    sop?: SopDraft;
    groundedAnswer?: GroundedAnswer;
  }> {
    const values = sendMessageSchema.parse(input);
    const conversation = await this.conversations.get(conversationId, actor.companyId);
    if (!conversation) throw appError("NOT_FOUND");
    this.assertConversationAccess(conversation, actor);
    const existing = await this.conversations.findMessageByIdempotencyKey(
      actor.companyId,
      conversationId,
      values.idempotencyKey,
    );
    if (existing) {
      return { ownerMessage: existing, assistantMessage: null, suggestedKnowledge: [] };
    }
    const now = new Date().toISOString();
    const ownerMessage: Message = {
      id: `message-${crypto.randomUUID()}`,
      companyId: actor.companyId,
      conversationId,
      actorType: "USER",
      actorId: actor.userId,
      content: values.content,
      sourceRefs: [],
      createdAt: now,
    };
    const persistedOwner = await this.conversations.appendMessage(ownerMessage, values.idempotencyKey);
    if (persistedOwner.id !== ownerMessage.id) {
      return { ownerMessage: persistedOwner, assistantMessage: null, suggestedKnowledge: [] };
    }
    const source = {
      sourceId: `source-${ownerMessage.id}`,
      label: conversation.title,
      messageId: ownerMessage.id,
      excerpt: ownerMessage.content.slice(0, 300),
    };
    await this.sources.saveConversationSource(actor.companyId, source);
    const requestedRoles = conversation.assistantRole === "EMPLOYEE"
      ? ["EMPLOYEE", "FRONT_DESK"] as const
      : [conversation.assistantRole];
    const approved = canAccess(actor, "READ", conversation.scope)
      ? await this.retrieval.retrieve(values.content, actor, [...requestedRoles], conversation.scope)
      : [];
    let generated: { content: string; sourceMemoryIds: string[] };
    let sop: SopDraft | undefined;
    let groundedAnswer: GroundedAnswer | undefined;

    if (conversation.assistantRole === "OPERATIONS") {
      sop = await this.model.generateSop({ request: values.content, approvedMemories: approved });
      generated = {
        content: [
          sop.title,
          sop.purpose,
          ...sop.steps.map((step) => `${step.order}. ${step.action}`),
        ].join("\n\n"),
        sourceMemoryIds: sop.sourceMemories.map((memory) => memory.memoryId),
      };
    } else if (conversation.assistantRole === "EMPLOYEE") {
      generated = await this.model.generateEmployeeResponse({
        question: values.content,
        approvedMemories: approved,
      });
      const sourceMemories = generated.sourceMemoryIds.flatMap((id) => {
        const memory = approved.find((item) => item.record.id === id);
        return memory ? [{
          memoryId: memory.record.id,
          version: memory.version.version,
          title: memory.version.title,
          approvedAt: memory.version.approvedAt,
        }] : [];
      });
      groundedAnswer = {
        answer: generated.content,
        groundingStatus: sourceMemories.length ? "GROUNDED" : "NO_APPROVED_CONTEXT",
        sourceMemories,
      };
    } else {
      generated = await this.model.generateMarketingResponse({
        message: values.content,
        approvedMemories: approved,
      });
    }
    const sourceRefs = generated.sourceMemoryIds.flatMap((id) => {
      const memory = approved.find((item) => item.record.id === id);
      return memory ? [{ sourceId: id, label: memory.version.title }] : [];
    });
    const assistantMessage: Message = {
      id: `message-${crypto.randomUUID()}`,
      companyId: actor.companyId,
      conversationId,
      actorType: "ASSISTANT",
      content: generated.content,
      sourceRefs,
      createdAt: new Date().toISOString(),
    };
    await this.conversations.appendMessage(assistantMessage);
    const candidate = conversation.assistantRole === "MARKETING" && canAccess(actor, "SUGGEST", conversation.scope)
      ? await this.suggestions.suggestFromConversation({
        content: values.content,
        idempotencyKey: values.idempotencyKey,
        scope: conversation.scope,
        conversationId: conversation.id,
        messageId: ownerMessage.id,
        source,
      }, actor)
      : null;
    return {
      ownerMessage,
      assistantMessage,
      suggestedKnowledge: candidate ? [candidate] : [],
      sop,
      groundedAnswer,
    };
  }

  private assertConversationAccess(conversation: Conversation, actor: ActorContext): void {
    if (!isOwner(actor) && conversation.createdBy !== actor.userId) throw appError("FORBIDDEN");
    if (!canAccess(actor, "READ", conversation.scope) && !canAccess(actor, "SUGGEST", conversation.scope)) {
      throw appError("FORBIDDEN");
    }
  }
}
