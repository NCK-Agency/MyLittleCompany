import type { DataMessagePart, TextMessagePart, ThreadMessageLike } from "@assistant-ui/react";
import type { GroundedAnswer, MemoryCandidate, SourceReference, SopDraft } from "@/domain/types";

export interface MlcUiMessage {
  id: string;
  role: "user" | "assistant";
  createdAt: string;
  text?: string;
  sources?: SourceReference[];
  candidate?: MemoryCandidate;
  sop?: SopDraft;
  sopSaved?: boolean;
  groundedAnswer?: GroundedAnswer;
}

export interface MlcSopPartData {
  messageId: string;
  sop: SopDraft;
  saved: boolean;
}

type MlcMessagePart = TextMessagePart | DataMessagePart;

export function convertMlcMessage(message: MlcUiMessage): ThreadMessageLike {
  const content: MlcMessagePart[] = [];

  if (message.text) {
    content.push({ type: "text", text: message.text });
  }
  if (message.sources?.length) {
    content.push({ type: "data", name: "mlc-sources", data: message.sources });
  }
  if (message.sop) {
    content.push({
      type: "data",
      name: "mlc-sop",
      data: { messageId: message.id, sop: message.sop, saved: Boolean(message.sopSaved) } satisfies MlcSopPartData,
    });
  }
  if (message.groundedAnswer) {
    content.push({ type: "data", name: "mlc-grounded-answer", data: message.groundedAnswer });
  }
  if (message.candidate) {
    content.push({ type: "data", name: "mlc-knowledge-candidate", data: message.candidate });
  }

  return {
    id: message.id,
    role: message.role,
    content,
    createdAt: new Date(message.createdAt),
    status: message.role === "assistant" ? { type: "complete", reason: "stop" } : undefined,
  };
}

export function readComposerText(content: ReadonlyArray<{ type: string; text?: string }>): string {
  return content
    .filter((part): part is { type: "text"; text: string } => part.type === "text" && typeof part.text === "string")
    .map((part) => part.text)
    .join("\n")
    .trim();
}
