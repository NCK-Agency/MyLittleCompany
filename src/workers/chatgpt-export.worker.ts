import { parseChatGptExport } from "@/domain/chatgpt-export";

interface ParseRequest { text: string }

self.onmessage = (event: MessageEvent<ParseRequest>): void => {
  try {
    const value = JSON.parse(event.data.text) as unknown;
    self.postMessage({ ok: true, conversations: parseChatGptExport(value) });
  } catch (error) {
    self.postMessage({
      ok: false,
      error: error instanceof Error ? error.message : "CHATGPT_EXPORT_INVALID",
    });
  }
};

export {};
