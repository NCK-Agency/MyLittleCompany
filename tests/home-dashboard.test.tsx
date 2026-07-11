import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HomeDashboard } from "@/components/home-dashboard";
import { ViewerProvider } from "@/components/viewer-context";
import type {
  ActorContext,
  Company,
  Conversation,
  HydratedMemory,
  MemoryCandidate,
} from "@/domain/types";
import { apiRequest } from "@/lib/api";

vi.mock("@/lib/api", () => ({ apiRequest: vi.fn() }));

const company: Company = {
  id: "company-1",
  name: "Maison Lumière",
  description: "A warm neighborhood salon.",
  productsOrServices: [],
  primaryCustomers: [],
  differentiators: [],
  brandVoice: [],
  organizationalUnits: [],
  timezone: "Asia/Ho_Chi_Minh",
  createdAt: "2026-07-01T00:00:00.000Z",
  updatedAt: "2026-07-11T00:00:00.000Z",
};

const conversation: Conversation = {
  id: "conversation-latest",
  companyId: company.id,
  title: "Tuesday promotion",
  assistantRole: "MARKETING",
  scope: { level: "COMPANY" },
  createdBy: "owner-1",
  createdAt: "2026-07-10T00:00:00.000Z",
  updatedAt: "2026-07-11T08:00:00.000Z",
};

const candidate: MemoryCandidate = {
  id: "candidate-1",
  version: 1,
  companyId: company.id,
  conversationId: conversation.id,
  scope: { level: "COMPANY" },
  type: "POLICY",
  title: "Promotional discount limit",
  statement: "Promotional discounts must not exceed 15%.",
  rationale: "Protect margins.",
  rationaleMissing: false,
  appliesToRoles: ["MARKETING"],
  tags: ["pricing"],
  sensitivity: "INTERNAL",
  sourceRefs: [{ sourceId: "source-1", label: "Tuesday promotion" }],
  confidence: 0.98,
  relation: "UNRELATED",
  relatedMemoryIds: [],
  status: "PROPOSED",
  extractionPromptVersion: "test",
  modelId: "fixture",
  createdBy: "owner-1",
  createdAt: "2026-07-11T08:00:00.000Z",
};

const memory: HydratedMemory = {
  record: {
    id: "memory-1",
    companyId: company.id,
    type: "POLICY",
    status: "APPROVED",
    currentVersion: 1,
    title: "Cancellation policy",
    scope: { level: "COMPANY" },
    appliesToRoles: ["EMPLOYEE"],
    sensitivity: "INTERNAL",
    tags: ["appointments"],
    effectiveFrom: "2026-07-01T00:00:00.000Z",
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-09T00:00:00.000Z",
    indexStatus: "READY",
  },
  version: {
    memoryId: "memory-1",
    companyId: company.id,
    version: 1,
    title: "Cancellation policy",
    scope: { level: "COMPANY" },
    statement: "Ask for 24 hours notice when possible.",
    rationale: "Keep the schedule useful.",
    appliesToRoles: ["EMPLOYEE"],
    sensitivity: "INTERNAL",
    tags: ["appointments"],
    effectiveFrom: "2026-07-01T00:00:00.000Z",
    sourceRefs: [{ sourceId: "source-2", label: "Owner note" }],
    approvedBy: "owner-1",
    approvedAt: "2026-07-09T00:00:00.000Z",
    createdAt: "2026-07-09T00:00:00.000Z",
  },
};

const owner: ActorContext = {
  userId: "owner-1",
  companyId: company.id,
  email: "owner@example.com",
  displayName: "Maya",
  roles: ["OWNER"],
  grants: [],
  demoMode: true,
};

const reader: ActorContext = {
  userId: "reader-1",
  companyId: company.id,
  email: "reader@example.com",
  displayName: "Lina",
  roles: ["EMPLOYEE"],
  grants: [{ permission: "READ", scope: { level: "COMPANY" } }],
  demoMode: true,
};

function mockDashboardRequests(): void {
  vi.mocked(apiRequest).mockImplementation(async (path) => {
    if (path === "/api/company") return company;
    if (path === "/api/conversations") return [conversation];
    if (path === "/api/memory-candidates") return [candidate];
    if (path === "/api/memories") return [memory];
    if (path === "/api/onboarding/sessions") return null;
    throw new Error(`Unexpected request: ${path}`);
  });
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("HomeDashboard", () => {
  it("shows the latest conversation, reviewable suggestions, and accessible approved knowledge", async () => {
    mockDashboardRequests();
    render(<ViewerProvider viewer={owner}><HomeDashboard /></ViewerProvider>);

    expect(await screen.findByRole("heading", { name: "Maison Lumière" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Tuesday promotion" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Continue conversation/ })).toHaveAttribute(
      "href",
      "/chat?conversation=conversation-latest",
    );
    expect(screen.getByTestId("pending-count")).toHaveTextContent("1");
    expect(screen.getByText("Promotional discount limit")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Cancellation policy" })).toBeInTheDocument();
    expect(screen.getByText("1 approved entry available to you.")).toBeInTheDocument();
  });

  it("does not request or show pending knowledge for a read-only viewer", async () => {
    mockDashboardRequests();
    render(<ViewerProvider viewer={reader}><HomeDashboard /></ViewerProvider>);

    expect(await screen.findByRole("heading", { name: "Tuesday promotion" })).toBeInTheDocument();
    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith("/api/memories"));
    expect(apiRequest).not.toHaveBeenCalledWith("/api/memory-candidates");
    expect(screen.queryByText("Suggested company knowledge")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Cancellation policy" })).toBeInTheDocument();
  });
});
