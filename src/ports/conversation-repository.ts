import type { Conversation, Message } from "@/domain/types";

export interface ConversationRepository {
  create(conversation: Conversation): Promise<Conversation>;
  list(companyId: string): Promise<Conversation[]>;
  get(conversationId: string, companyId: string): Promise<Conversation | null>;
  listMessages(conversationId: string, companyId: string): Promise<Message[]>;
  appendMessage(message: Message, idempotencyKey?: string): Promise<Message>;
  findMessageByIdempotencyKey(
    companyId: string,
    conversationId: string,
    idempotencyKey: string,
  ): Promise<Message | null>;
}
