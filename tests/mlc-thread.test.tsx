import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MemoryCandidate } from "@/domain/types";
import { MlcThread } from "@/components/assistant-ui/mlc-thread";
import { ViewerProvider } from "@/components/viewer-context";
import { ownerActor } from "@/server/actors";

const candidate: MemoryCandidate = {
  id: "candidate-thread-1",
  version: 1,
  companyId: "company-1",
  conversationId: "conversation-1",
  scope: { level: "COMPANY" },
  type: "DECISION",
  title: "Promotional discounts must not exceed 15%",
  statement: "Never discount more than 15%.",
  rationale: "Protect the premium positioning.",
  rationaleMissing: false,
  appliesToRoles: ["MARKETING", "SALES"],
  tags: ["pricing"],
  sensitivity: "INTERNAL",
  sourceRefs: [{ sourceId: "source-1", label: "Tuesday campaign conversation" }],
  confidence: 0.98,
  relation: "CONTRADICTION",
  relatedMemoryIds: ["memory-old"],
  status: "PROPOSED",
  extractionPromptVersion: "v1",
  modelId: "fixture",
  createdBy: "owner-1",
  createdAt: "2026-07-11T00:00:00.000Z",
};

afterEach(cleanup);

describe("MLC assistant-ui thread", () => {
  it("renders internal source chips and a human-controlled knowledge card", () => {
    render(
      <ViewerProvider viewer={ownerActor()}><MlcThread
        error=""
        isRunning={false}
        messages={[{
          id: "assistant-1",
          role: "assistant",
          createdAt: "2026-07-11T00:00:00.000Z",
          text: "I will keep the promotion within the current rule.",
          sources: [{ sourceId: "memory-1", label: "15% promotion rule" }],
          candidate,
        }]}
        onCandidateChanged={vi.fn()}
        onNew={vi.fn(async () => undefined)}
        onSaveSop={vi.fn()}
        restoreDraft={null}
        role="MARKETING"
        status=""
      /></ViewerProvider>,
    );

    expect(screen.getByText("Source · 15% promotion rule")).toBeInTheDocument();
    expect(screen.getByText("My Little Company noticed something worth remembering.")).toBeInTheDocument();
    expect(screen.getByTestId("candidate-card")).toContainElement(screen.getByRole("button", { name: "Replace current rule" }));
    expect(screen.getByText(/Possible conflict/)).toBeInTheDocument();
  });

  it("submits on Enter and can restore a failed draft", async () => {
    const onNew = vi.fn(async () => undefined);
    const { rerender } = render(
      <MlcThread
        error=""
        isRunning={false}
        messages={[]}
        onCandidateChanged={vi.fn()}
        onNew={onNew}
        onSaveSop={vi.fn()}
        restoreDraft={null}
        role="MARKETING"
        status=""
      />,
    );
    const composer = screen.getByLabelText("Message Marketing");
    fireEvent.change(composer, { target: { value: "Create a Tuesday promotion" } });
    fireEvent.keyDown(composer, { key: "Enter", code: "Enter" });

    await waitFor(() => expect(onNew).toHaveBeenCalledOnce());

    rerender(
      <MlcThread
        error="Could not send the message."
        isRunning={false}
        messages={[]}
        onCandidateChanged={vi.fn()}
        onNew={onNew}
        onSaveSop={vi.fn()}
        restoreDraft={{ text: "Create a Tuesday promotion", requestId: 1 }}
        role="MARKETING"
        status=""
      />,
    );

    await waitFor(() => expect(screen.getByLabelText("Message Marketing")).toHaveValue("Create a Tuesday promotion"));
    expect(screen.getByText("Could not send the message.")).toHaveAttribute("aria-live", "polite");
  });

  it("offers retry and owner settings when the selected model is unavailable", async () => {
    const onNew = vi.fn(async () => undefined);
    render(
      <MlcThread
        error="This assistant model is temporarily unavailable."
        isRunning={false}
        messages={[]}
        onCandidateChanged={vi.fn()}
        onNew={onNew}
        onSaveSop={vi.fn()}
        restoreDraft={{ text: "Create a Tuesday promotion", requestId: 2 }}
        role="MARKETING"
        showModelSettings
        status=""
      />,
    );

    await waitFor(() => expect(screen.getByLabelText("Message Marketing")).toHaveValue("Create a Tuesday promotion"));
    expect(screen.getByRole("link", { name: "Assistant settings" })).toHaveAttribute("href", "/workspace#assistant-settings");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(onNew).toHaveBeenCalledOnce());
  });
});
