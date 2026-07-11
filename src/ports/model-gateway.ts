import type {
  ConflictRelation,
  HydratedMemory,
  MemoryCandidate,
  Message,
  ModelOperationMetadata,
  SopDraft,
} from "@/domain/types";

export interface GeneratedText {
  content: string;
  sourceMemoryIds: string[];
  metadata?: ModelOperationMetadata;
}

export interface ModelGateway {
  generateMarketingResponse(input: {
    companyId: string;
    message: string;
    approvedMemories: HydratedMemory[];
  }): Promise<GeneratedText>;
  generateEmployeeResponse(input: {
    companyId: string;
    question: string;
    approvedMemories: HydratedMemory[];
  }): Promise<GeneratedText>;
  generateProofResponse(input: {
    companyId: string;
    question: string;
    approvedMemories: HydratedMemory[];
  }): Promise<GeneratedText>;
  extractCandidate(input: {
    companyId: string;
    ownerMessage: Message;
    createdBy: string;
  }): Promise<MemoryCandidate | null>;
  extractOnboardingCandidates(input: {
    companyId: string;
    createdBy: string;
    proofQuestion: string;
    source: {
      sourceId: string;
      label: string;
      content: string;
    };
  }): Promise<MemoryCandidate[]>;
  classifyRelationship(input: {
    companyId: string;
    candidate: MemoryCandidate;
    approvedMemories: HydratedMemory[];
  }): Promise<{
    relation: ConflictRelation;
    relatedMemoryIds: string[];
    summary: string;
    clarificationQuestion: string | null;
    confidence: number;
    metadata?: ModelOperationMetadata;
  }>;
  generateSop(input: {
    companyId: string;
    request: string;
    approvedMemories: HydratedMemory[];
  }): Promise<SopDraft>;
}
