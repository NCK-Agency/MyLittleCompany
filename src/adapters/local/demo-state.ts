import demoFixture from "../../../fixtures/demo-company.json";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import type {
  AuditEvent,
  Company,
  CompanyMembership,
  Conversation,
  HydratedMemory,
  MemoryCandidate,
  MemoryVersion,
  Message,
  ImportBatch,
  ImportedItem,
  OnboardingSession,
  StoredImportedSource,
  SourceReference,
} from "@/domain/types";
import {
  candidateSchema,
  companySchema,
  conversationSchema,
  memoryRecordSchema,
  memoryVersionSchema,
  companyMembershipSchema,
} from "@/domain/schemas";

export interface DemoState {
  company: Company;
  memberships: CompanyMembership[];
  conversations: Conversation[];
  messages: Message[];
  messageIdempotency: Map<string, string>;
  candidates: MemoryCandidate[];
  memories: HydratedMemory[];
  memoryVersions: MemoryVersion[];
  indexedMemoryIds: Set<string>;
  sources: SourceReference[];
  auditEvents: AuditEvent[];
  onboardingSessions: OnboardingSession[];
  importBatches: ImportBatch[];
  importedItems: ImportedItem[];
  importedSources: StoredImportedSource[];
}

export function createDemoState(): DemoState {
  const memories = demoFixture.approvedMemories.map((item) => ({
    record: memoryRecordSchema.parse({
      id: item.id,
      companyId: item.companyId,
      type: item.type,
      status: item.status,
      currentVersion: item.currentVersion,
      title: item.title,
      scope: item.scope,
      appliesToRoles: item.appliesToRoles,
      sensitivity: item.sensitivity,
      tags: item.tags,
      effectiveFrom: item.effectiveFrom,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      indexStatus: item.indexStatus,
    }),
    version: memoryVersionSchema.parse(item.version),
  }));

  return {
    company: structuredClone(demoFixture.company) as Company,
    memberships: demoFixture.memberships.map((membership) => companyMembershipSchema.parse(membership)),
    conversations: [],
    messages: [],
    messageIdempotency: new Map(),
    candidates: [],
    memories,
    memoryVersions: memories.map((memory) => memory.version),
    indexedMemoryIds: new Set(memories.map((memory) => memory.record.id)),
    sources: [{ sourceId: "source-demo-profile", label: "Demo company profile" }],
    auditEvents: [],
    onboardingSessions: [],
    importBatches: [],
    importedItems: [],
    importedSources: [],
  };
}

const globalState = globalThis as typeof globalThis & { __mlcDemoState?: DemoState };

interface SerializedDemoState extends Omit<DemoState, "messageIdempotency" | "indexedMemoryIds" | "memoryVersions"> {
  messageIdempotency: Array<[string, string]>;
  indexedMemoryIds: string[];
  memoryVersions?: MemoryVersion[];
}

function statePath(): string {
  return process.env.NETLIFY
    ? join(tmpdir(), "mlc-demo-state.json")
    : join(process.cwd(), ".data", "demo-state.json");
}

function serialize(state: DemoState): SerializedDemoState {
  return {
    ...state,
    messageIdempotency: [...state.messageIdempotency.entries()],
    indexedMemoryIds: [...state.indexedMemoryIds],
  };
}

function hydrate(state: SerializedDemoState): DemoState {
  const company = companySchema.parse({
    ...state.company,
    organizationalUnits: state.company.organizationalUnits ?? demoFixture.company.organizationalUnits,
  });
  const memories = state.memories.map((memory) => ({
    record: memoryRecordSchema.parse(memory.record),
    version: memoryVersionSchema.parse(memory.version),
  }));
  return {
    ...state,
    company,
    memberships: (state.memberships ?? demoFixture.memberships)
      .map((membership) => companyMembershipSchema.parse(membership)),
    conversations: state.conversations.map((conversation) => conversationSchema.parse(conversation)),
    candidates: state.candidates.map((candidate) => candidateSchema.parse(candidate)),
    memories,
    memoryVersions: (state.memoryVersions ?? memories.map((memory) => memory.version))
      .map((version) => memoryVersionSchema.parse(version)),
    messageIdempotency: new Map(state.messageIdempotency),
    indexedMemoryIds: new Set(state.indexedMemoryIds),
    onboardingSessions: state.onboardingSessions ?? [],
    importBatches: state.importBatches ?? [],
    importedItems: state.importedItems ?? [],
    importedSources: state.importedSources ?? [],
  };
}

export function saveDemoState(state = getDemoState()): void {
  if (process.env.NODE_ENV === "test") return;
  const path = statePath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(serialize(state)), "utf8");
}

export function getDemoState(): DemoState {
  if (process.env.NODE_ENV !== "test" && existsSync(statePath())) {
    globalState.__mlcDemoState = hydrate(JSON.parse(readFileSync(statePath(), "utf8")) as SerializedDemoState);
  }
  globalState.__mlcDemoState ??= createDemoState();
  return globalState.__mlcDemoState;
}

export function resetDemoState(): DemoState {
  globalState.__mlcDemoState = createDemoState();
  saveDemoState(globalState.__mlcDemoState);
  return globalState.__mlcDemoState;
}
