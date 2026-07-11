import demoFixture from "../../../fixtures/demo-company.json";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import type {
  AuditEvent,
  Company,
  Conversation,
  HydratedMemory,
  MemoryCandidate,
  Message,
  SourceReference,
} from "@/domain/types";
import { memoryRecordSchema, memoryVersionSchema } from "@/domain/schemas";

export interface DemoState {
  company: Company;
  conversations: Conversation[];
  messages: Message[];
  messageIdempotency: Map<string, string>;
  candidates: MemoryCandidate[];
  memories: HydratedMemory[];
  indexedMemoryIds: Set<string>;
  sources: SourceReference[];
  auditEvents: AuditEvent[];
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
    conversations: [],
    messages: [],
    messageIdempotency: new Map(),
    candidates: [],
    memories,
    indexedMemoryIds: new Set(memories.map((memory) => memory.record.id)),
    sources: [{ sourceId: "source-demo-profile", label: "Demo company profile" }],
    auditEvents: [],
  };
}

const globalState = globalThis as typeof globalThis & { __mlcDemoState?: DemoState };

interface SerializedDemoState extends Omit<DemoState, "messageIdempotency" | "indexedMemoryIds"> {
  messageIdempotency: Array<[string, string]>;
  indexedMemoryIds: string[];
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
  return {
    ...state,
    messageIdempotency: new Map(state.messageIdempotency),
    indexedMemoryIds: new Set(state.indexedMemoryIds),
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
