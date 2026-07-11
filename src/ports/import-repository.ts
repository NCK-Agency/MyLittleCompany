import type { ImportBatch, ImportedItem, OnboardingSession } from "@/domain/types";

export interface ImportRepository {
  createSession(session: OnboardingSession): Promise<OnboardingSession>;
  getSession(sessionId: string, companyId: string): Promise<OnboardingSession | null>;
  getActiveSession(companyId: string, actorId: string): Promise<OnboardingSession | null>;
  updateSession(session: OnboardingSession, expectedVersion: number): Promise<OnboardingSession>;
  createBatch(batch: ImportBatch, item: ImportedItem): Promise<ImportBatch>;
  getBatch(batchId: string, companyId: string): Promise<ImportBatch | null>;
  findBatchByIdempotencyKey(companyId: string, idempotencyKey: string): Promise<ImportBatch | null>;
  updateBatch(batch: ImportBatch, expectedVersion: number): Promise<ImportBatch>;
  getItem(itemId: string, companyId: string): Promise<ImportedItem | null>;
  updateItem(item: ImportedItem): Promise<ImportedItem>;
}
