import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { waitlistEntrySchema } from "@/domain/schemas";
import type { WaitlistEntry } from "@/domain/types";
import type { WaitlistRepository } from "@/ports/waitlist-repository";

const globalWaitlist = globalThis as typeof globalThis & { __mlcWaitlist?: WaitlistEntry[] };

function waitlistPath(): string {
  return process.env.NETLIFY
    ? join(tmpdir(), "mlc-waitlist.json")
    : join(process.cwd(), ".data", "waitlist.json");
}

function loadEntries(): WaitlistEntry[] {
  if (globalWaitlist.__mlcWaitlist) return globalWaitlist.__mlcWaitlist;
  if (process.env.NODE_ENV === "test" || !existsSync(waitlistPath())) {
    globalWaitlist.__mlcWaitlist = [];
    return globalWaitlist.__mlcWaitlist;
  }
  const stored = JSON.parse(readFileSync(waitlistPath(), "utf8")) as unknown[];
  globalWaitlist.__mlcWaitlist = stored.map((entry) => waitlistEntrySchema.parse(entry));
  return globalWaitlist.__mlcWaitlist;
}

function saveEntries(entries: WaitlistEntry[]): void {
  if (process.env.NODE_ENV === "test") return;
  const path = waitlistPath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(entries), "utf8");
}

export class LocalWaitlistRepository implements WaitlistRepository {
  async upsertByEmail(entry: WaitlistEntry): Promise<WaitlistEntry> {
    const parsed = waitlistEntrySchema.parse(entry);
    const entries = loadEntries();
    const existing = entries.find((item) => item.email === parsed.email);
    if (existing) return existing;
    entries.push(parsed);
    saveEntries(entries);
    return parsed;
  }
}
