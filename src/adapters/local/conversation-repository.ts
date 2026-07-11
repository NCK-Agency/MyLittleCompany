import type { Conversation, Message } from "@/domain/types";
import type { ConversationRepository } from "@/ports/conversation-repository";
import { getDemoState, saveDemoState } from "./demo-state";

export class LocalConversationRepository implements ConversationRepository {
  private idempotencyScope(companyId: string, conversationId: string, key: string): string {
    return `${companyId}:${conversationId}:${key}`;
  }

  async create(conversation: Conversation): Promise<Conversation> {
    const state = getDemoState();
    state.conversations.push(conversation);
    saveDemoState(state);
    return conversation;
  }

  async list(companyId: string): Promise<Conversation[]> {
    return getDemoState().conversations
      .filter((conversation) => conversation.companyId === companyId)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  async get(conversationId: string, companyId: string): Promise<Conversation | null> {
    return getDemoState().conversations.find(
      (conversation) => conversation.id === conversationId && conversation.companyId === companyId,
    ) ?? null;
  }

  async listMessages(conversationId: string, companyId: string): Promise<Message[]> {
    return getDemoState().messages.filter(
      (message) => message.conversationId === conversationId && message.companyId === companyId,
    );
  }

  async appendMessage(message: Message, idempotencyKey?: string): Promise<Message> {
    const state = getDemoState();
    if (idempotencyKey) {
      const scope = this.idempotencyScope(message.companyId, message.conversationId, idempotencyKey);
      const existingId = state.messageIdempotency.get(scope);
      const existing = state.messages.find((item) => item.id === existingId);
      if (existing) return existing;
      state.messageIdempotency.set(scope, message.id);
    }
    state.messages.push(message);
    const conversation = state.conversations.find(
      (item) => item.id === message.conversationId && item.companyId === message.companyId,
    );
    if (conversation) conversation.updatedAt = message.createdAt;
    saveDemoState(state);
    return message;
  }

  async findMessageByIdempotencyKey(
    companyId: string,
    conversationId: string,
    idempotencyKey: string,
  ): Promise<Message | null> {
    const state = getDemoState();
    const id = state.messageIdempotency.get(
      this.idempotencyScope(companyId, conversationId, idempotencyKey),
    );
    return state.messages.find((message) => message.id === id) ?? null;
  }
}
