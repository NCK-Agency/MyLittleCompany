import { z } from "zod";

const messageSchema = z.object({
  id: z.string().optional(),
  author: z.object({ role: z.string() }).optional(),
  create_time: z.number().nullable().optional(),
  content: z.object({ parts: z.array(z.unknown()).optional() }).optional(),
}).nullable().optional();

const nodeSchema = z.object({
  id: z.string().optional(),
  parent: z.string().nullable().optional(),
  message: messageSchema,
});

const conversationSchema = z.object({
  id: z.string().optional(),
  conversation_id: z.string().optional(),
  title: z.string().nullable().optional(),
  current_node: z.string().min(1),
  mapping: z.record(z.string(), nodeSchema),
  update_time: z.number().nullable().optional(),
});

export interface ChatGptConversationPreview {
  id: string;
  title: string;
  updatedAt: string | null;
  messageCount: number;
  content: string;
  truncated: boolean;
}

function messageText(value: z.infer<typeof messageSchema>): string | null {
  if (!value) return null;
  const role = value?.author?.role;
  if (role !== "user" && role !== "assistant") return null;
  const content = (value.content?.parts ?? []).flatMap((part) => typeof part === "string" ? [part.trim()] : []).filter(Boolean).join("\n");
  if (!content) return null;
  const timestamp = value.create_time ? new Date(value.create_time * 1000).toISOString() : "unknown-time";
  return `[${role} · ${timestamp} · ${value.id ?? "unknown-message"}]\n${content}`;
}

export function parseChatGptExport(input: unknown, maxCharacters = 40_000): ChatGptConversationPreview[] {
  const conversations = z.array(conversationSchema).parse(input);
  return conversations.map((conversation, index) => {
    const path: string[] = [];
    const visited = new Set<string>();
    let current: string | null | undefined = conversation.current_node;
    while (current) {
      if (visited.has(current)) throw new Error("CHATGPT_EXPORT_CYCLE");
      visited.add(current);
      const node: z.infer<typeof nodeSchema> | undefined = conversation.mapping[current];
      if (!node) throw new Error("CHATGPT_EXPORT_MISSING_NODE");
      path.push(current);
      current = node.parent;
    }
    const messages = path.reverse().flatMap((nodeId) => {
      const text = messageText(conversation.mapping[nodeId]?.message);
      return text ? [text] : [];
    });
    const selected: string[] = [];
    let used = 0;
    for (let messageIndex = messages.length - 1; messageIndex >= 0; messageIndex -= 1) {
      const message = messages[messageIndex]!;
      if (used + message.length + 2 > maxCharacters && selected.length > 0) break;
      selected.unshift(message);
      used += message.length + 2;
      if (used >= maxCharacters) break;
    }
    const id = conversation.id ?? conversation.conversation_id ?? `conversation-${index + 1}`;
    return {
      id,
      title: conversation.title?.trim() || `Untitled conversation ${index + 1}`,
      updatedAt: conversation.update_time ? new Date(conversation.update_time * 1000).toISOString() : null,
      messageCount: messages.length,
      content: selected.join("\n\n").slice(-maxCharacters),
      truncated: selected.length < messages.length,
    };
  }).filter((conversation) => conversation.messageCount > 0)
    .sort((left, right) => (right.updatedAt ?? "").localeCompare(left.updatedAt ?? ""));
}
