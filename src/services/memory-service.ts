import { transitionCandidate, transitionIndex } from "@/domain/lifecycle";
import { isMemoryEligible } from "@/domain/retrieval";
import { updateCandidateSchema } from "@/domain/schemas";
import type { ActorContext, HydratedMemory, MemoryCandidate } from "@/domain/types";
import type { KnowledgeIndex } from "@/ports/knowledge-index";
import type { MemoryRepository } from "@/ports/memory-repository";

function assertOwner(actor: ActorContext): void {
  if (!actor.roles.includes("OWNER")) throw new Error("FORBIDDEN");
}

export class MemoryService {
  constructor(
    private readonly memories: MemoryRepository,
    private readonly index: KnowledgeIndex,
  ) {}

  async listCandidates(actor: ActorContext): Promise<MemoryCandidate[]> {
    return this.memories.listCandidates(actor.companyId);
  }

  async listMemories(actor: ActorContext): Promise<HydratedMemory[]> {
    return (await this.memories.listCurrent(actor.companyId)).filter((memory) =>
      isMemoryEligible(memory, actor),
    );
  }

  async getMemory(id: string, actor: ActorContext): Promise<HydratedMemory | null> {
    const memory = await this.memories.getCurrent(id, actor.companyId);
    return memory && isMemoryEligible(memory, actor) ? memory : null;
  }

  async updateCandidate(
    id: string,
    input: unknown,
    actor: ActorContext,
  ): Promise<MemoryCandidate> {
    assertOwner(actor);
    const values = updateCandidateSchema.parse(input);
    const candidate = await this.memories.getCandidate(id, actor.companyId);
    if (!candidate) throw new Error("NOT_FOUND");
    if (candidate.status !== "PROPOSED") throw new Error("CONFLICT");
    if (candidate.version !== values.expectedCandidateVersion) throw new Error("STALE_WRITE");
    return this.memories.updateCandidate({
      ...candidate,
      ...values,
      rationaleMissing: values.rationale === null,
      version: candidate.version + 1,
    });
  }

  async rejectCandidate(id: string, actor: ActorContext): Promise<MemoryCandidate> {
    assertOwner(actor);
    const candidate = await this.memories.getCandidate(id, actor.companyId);
    if (!candidate) throw new Error("NOT_FOUND");
    const now = new Date().toISOString();
    return this.memories.updateCandidate({
      ...candidate,
      status: transitionCandidate(candidate.status, "REJECTED"),
      reviewedBy: actor.userId,
      reviewedAt: now,
    });
  }

  async approveCandidate(
    id: string,
    expectedVersion: number,
    actor: ActorContext,
  ): Promise<HydratedMemory> {
    assertOwner(actor);
    const candidate = await this.memories.getCandidate(id, actor.companyId);
    if (!candidate) throw new Error("NOT_FOUND");
    if (candidate.version !== expectedVersion) throw new Error("STALE_WRITE");
    candidate.status = transitionCandidate(candidate.status, "APPROVING");
    await this.memories.updateCandidate(candidate);
    const now = new Date().toISOString();
    const memory = await this.memories.createApproved(candidate, actor.userId, now);
    try {
      const indexed = await this.index.upsert(memory);
      memory.record.indexStatus = transitionIndex(memory.record.indexStatus, "READY");
      memory.record.indexDocumentId = indexed.documentId;
      await this.memories.updateRecord(memory.record);
    } catch {
      memory.record.indexStatus = transitionIndex(memory.record.indexStatus, "FAILED");
      memory.record.indexErrorCode = "LOCAL_INDEX_FAILED";
      await this.memories.updateRecord(memory.record);
    }
    await this.memories.appendAudit({
      id: `audit-${crypto.randomUUID()}`,
      companyId: actor.companyId,
      actorId: actor.userId,
      action: "CANDIDATE_APPROVED",
      targetType: "MEMORY",
      targetId: memory.record.id,
      createdAt: now,
    });
    return memory;
  }

  async retryIndex(memoryId: string, actor: ActorContext): Promise<HydratedMemory> {
    assertOwner(actor);
    const memory = await this.memories.getCurrent(memoryId, actor.companyId);
    if (!memory) throw new Error("NOT_FOUND");
    if (memory.record.indexStatus !== "FAILED") throw new Error("CONFLICT");
    memory.record.indexStatus = transitionIndex(memory.record.indexStatus, "PENDING");
    await this.memories.updateRecord(memory.record);
    try {
      const indexed = await this.index.upsert(memory);
      memory.record.indexStatus = transitionIndex(memory.record.indexStatus, "READY");
      memory.record.indexDocumentId = indexed.documentId;
      delete memory.record.indexErrorCode;
    } catch {
      memory.record.indexStatus = transitionIndex(memory.record.indexStatus, "FAILED");
      memory.record.indexErrorCode = "LOCAL_INDEX_FAILED";
    }
    await this.memories.updateRecord(memory.record);
    return memory;
  }
}
