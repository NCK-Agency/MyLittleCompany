import { createConversationSchema, sendMessageSchema } from "@/domain/schemas";
import type { ActorContext, Conversation, Message } from "@/domain/types";
import type { ConversationRepository } from "@/ports/conversation-repository";
import type { KnowledgeIndex } from "@/ports/knowledge-index";
import type { MemoryRepository } from "@/ports/memory-repository";
import type { ModelGateway } from "@/ports/model-gateway";
import type { SourceRepository } from "@/ports/source-repository";

export class ConversationService {
  constructor(
    private readonly conversations: ConversationRepository,
    private readonly memories: MemoryRepository,
    private readonly index: KnowledgeIndex,
    private readonly model: ModelGateway,
    private readonly sources: SourceRepository,
  ) {}

  async create(input: unknown, actor: ActorContext): Promise<Conversation> {
    const values = createConversationSchema.parse(input);
    const now = new Date().toISOString();
    return this.conversations.create({
      id: `conversation-${crypto.randomUUID()}`,
      companyId: actor.companyId,
      title: values.title,
      assistantRole: values.assistantRole,
      createdBy: actor.userId,
      createdAt: now,
      updatedAt: now,
    });
  }

  async listMessages(conversationId: string, actor: ActorContext): Promise<Message[]> {
    const conversation = await this.conversations.get(conversationId, actor.companyId);
    if (!conversation) throw new Error("NOT_FOUND");
    return this.conversations.listMessages(conversationId, actor.companyId);
  }

  async send(conversationId: string, input: unknown, actor: ActorContext) {
    const values = sendMessageSchema.parse(input);
    const conversation = await this.conversations.get(conversationId, actor.companyId);
    if (!conversation) throw new Error("NOT_FOUND");
    const existing = await this.conversations.findMessageByIdempotencyKey(values.idempotencyKey);
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
    await this.conversations.appendMessage(ownerMessage, values.idempotencyKey);
    const source = {
      sourceId: `source-${ownerMessage.id}`,
      label: "Tuesday campaign conversation",
      messageId: ownerMessage.id,
      excerpt: ownerMessage.content.slice(0, 300),
    };
    await this.sources.saveConversationSource(source);
    const approved = await this.index.retrieve(values.content, {
      ...actor,
      roles: conversation.assistantRole === "MARKETING" ? ["MARKETING"] : actor.roles,
    });
    const generated = await this.model.generateMarketingResponse({
      message: values.content,
      approvedMemories: approved,
    });
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
    const candidate = await this.model.extractCandidate({ ownerMessage, createdBy: actor.userId });
    if (candidate) await this.memories.createCandidate(candidate);
    return {
      ownerMessage,
      assistantMessage,
      suggestedKnowledge: candidate ? [candidate] : [],
    };
  }
}
