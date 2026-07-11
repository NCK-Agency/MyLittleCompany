import { describe, expect, it } from "vitest";
import { parseChatGptExport } from "@/domain/chatgpt-export";

function message(id: string, parent: string | null, role: string, text: string) {
  return {
    id,
    parent,
    message: {
      id: `message-${id}`,
      author: { role },
      create_time: 1_700_000_000,
      content: { parts: [text] },
    },
  };
}

describe("ChatGPT export parser", () => {
  it("follows only the active branch and preserves message locators", () => {
    const result = parseChatGptExport([{
      id: "conversation-1",
      title: "Discount policy",
      current_node: "assistant-active",
      mapping: {
        root: message("root", null, "system", "hidden"),
        user: message("user", "root", "user", "We never discount more than 15%."),
        "assistant-old": message("assistant-old", "user", "assistant", "Old branch"),
        "assistant-active": message("assistant-active", "user", "assistant", "Understood."),
      },
      update_time: 1_700_000_001,
    }]);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: "conversation-1", title: "Discount policy", messageCount: 2 });
    expect(result[0]?.content).toContain("message-user");
    expect(result[0]?.content).toContain("assistant-active");
    expect(result[0]?.content).not.toContain("Old branch");
    expect(result[0]?.content).not.toContain("hidden");
  });

  it("rejects cycles and missing active nodes", () => {
    expect(() => parseChatGptExport([{
      title: "Cycle",
      current_node: "a",
      mapping: {
        a: { ...message("a", "b", "user", "A"), parent: "b" },
        b: { ...message("b", "a", "assistant", "B"), parent: "a" },
      },
    }])).toThrow("CHATGPT_EXPORT_CYCLE");
    expect(() => parseChatGptExport([{ title: "Missing", current_node: "missing", mapping: {} }]))
      .toThrow("CHATGPT_EXPORT_MISSING_NODE");
  });

  it("keeps the most recent whole messages inside the quick-setup limit", () => {
    const result = parseChatGptExport([{
      id: "conversation-long",
      title: "Long",
      current_node: "third",
      mapping: {
        first: message("first", null, "user", "A".repeat(80)),
        second: message("second", "first", "assistant", "B".repeat(80)),
        third: message("third", "second", "user", "C".repeat(80)),
      },
    }], 180);
    expect(result[0]?.truncated).toBe(true);
    expect(result[0]?.content).toContain("C".repeat(20));
    expect(result[0]?.content).not.toContain("A".repeat(20));
  });
});
