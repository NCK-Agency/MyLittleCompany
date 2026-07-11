import type { HydratedMemory, MemoryCandidate, Message, SopDraft } from "@/domain/types";

export interface ModelGateway {
  generateMarketingResponse(input: {
    message: string;
    approvedMemories: HydratedMemory[];
  }): Promise<{ content: string; sourceMemoryIds: string[] }>;
  extractCandidate(input: {
    ownerMessage: Message;
    createdBy: string;
  }): Promise<MemoryCandidate | null>;
  generateSop(approvedMemories: HydratedMemory[]): Promise<SopDraft>;
}
