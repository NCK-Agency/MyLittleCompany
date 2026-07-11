import type { Conversation, Message } from "@/domain/types";
import type { ConversationRepository } from "@/ports/conversation-repository";
import { getDemoState, saveDemoState } from "./demo-state";

export class LocalConversationRepository implements ConversationRepository {
  async create(conversation: Conversation): Promise<Conversation> {
    const state = getDemoState();
    state.conversations.push(conversation);
    saveDemoState(state);
    return conversation;
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
      const existingId = state.messageIdempotency.get(idempotencyKey);
      const existing = state.messages.find((item) => item.id === existingId);
      if (existing) return existing;
      state.messageIdempotency.set(idempotencyKey, message.id);
    }
    state.messages.push(message);
    saveDemoState(state);
    return message;
  }

  async findMessageByIdempotencyKey(idempotencyKey: string): Promise<Message | null> {
    const state = getDemoState();
    const id = state.messageIdempotency.get(idempotencyKey);
    return state.messages.find((message) => message.id === id) ?? null;
  }
}
