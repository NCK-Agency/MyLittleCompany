import { appError } from "@/domain/errors";
import {
  importBatchSchema,
  importedItemSchema,
  onboardingSessionSchema,
} from "@/domain/schemas";
import type { ImportBatch, ImportedItem, OnboardingSession } from "@/domain/types";
import type { ImportRepository } from "@/ports/import-repository";
import { getDemoState, saveDemoState } from "./demo-state";

export class LocalImportRepository implements ImportRepository {
  async createSession(session: OnboardingSession): Promise<OnboardingSession> {
    const state = getDemoState();
    if (state.onboardingSessions.some((item) => item.id === session.id)) throw appError("CONFLICT");
    const parsed = onboardingSessionSchema.parse(session);
    state.onboardingSessions.push(parsed);
    saveDemoState(state);
    return parsed;
  }

  async getSession(sessionId: string, companyId: string): Promise<OnboardingSession | null> {
    return getDemoState().onboardingSessions.find((item) => item.id === sessionId && item.companyId === companyId) ?? null;
  }

  async getActiveSession(companyId: string, actorId: string): Promise<OnboardingSession | null> {
    return getDemoState().onboardingSessions
      .filter((item) => item.companyId === companyId && item.createdBy === actorId && !["COMPLETED", "SKIPPED"].includes(item.state))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ?? null;
  }

  async updateSession(session: OnboardingSession, expectedVersion: number): Promise<OnboardingSession> {
    const state = getDemoState();
    const index = state.onboardingSessions.findIndex((item) => item.id === session.id && item.companyId === session.companyId);
    if (index < 0) throw appError("NOT_FOUND");
    if (state.onboardingSessions[index]?.version !== expectedVersion) throw appError("STALE_WRITE");
    const parsed = onboardingSessionSchema.parse(session);
    state.onboardingSessions[index] = parsed;
    saveDemoState(state);
    return parsed;
  }

  async createBatch(batch: ImportBatch, item: ImportedItem): Promise<ImportBatch> {
    const state = getDemoState();
    if (state.importBatches.some((value) => value.id === batch.id || (
      value.companyId === batch.companyId && value.idempotencyKey === batch.idempotencyKey
    ))) throw appError("CONFLICT");
    const parsedBatch = importBatchSchema.parse(batch);
    state.importBatches.push(parsedBatch);
    state.importedItems.push(importedItemSchema.parse(item));
    saveDemoState(state);
    return parsedBatch;
  }

  async getBatch(batchId: string, companyId: string): Promise<ImportBatch | null> {
    return getDemoState().importBatches.find((item) => item.id === batchId && item.companyId === companyId) ?? null;
  }

  async findBatchByIdempotencyKey(companyId: string, idempotencyKey: string): Promise<ImportBatch | null> {
    return getDemoState().importBatches.find((item) => item.companyId === companyId && item.idempotencyKey === idempotencyKey) ?? null;
  }

  async updateBatch(batch: ImportBatch, expectedVersion: number): Promise<ImportBatch> {
    const state = getDemoState();
    const index = state.importBatches.findIndex((item) => item.id === batch.id && item.companyId === batch.companyId);
    if (index < 0) throw appError("NOT_FOUND");
    if (state.importBatches[index]?.version !== expectedVersion) throw appError("STALE_WRITE");
    const parsed = importBatchSchema.parse(batch);
    state.importBatches[index] = parsed;
    saveDemoState(state);
    return parsed;
  }

  async getItem(itemId: string, companyId: string): Promise<ImportedItem | null> {
    return getDemoState().importedItems.find((item) => item.id === itemId && item.companyId === companyId) ?? null;
  }

  async updateItem(item: ImportedItem): Promise<ImportedItem> {
    const state = getDemoState();
    const index = state.importedItems.findIndex((value) => value.id === item.id && value.companyId === item.companyId);
    if (index < 0) throw appError("NOT_FOUND");
    const parsed = importedItemSchema.parse(item);
    state.importedItems[index] = parsed;
    saveDemoState(state);
    return parsed;
  }
}
