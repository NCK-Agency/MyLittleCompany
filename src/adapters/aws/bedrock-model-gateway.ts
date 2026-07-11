import {
  ConverseCommand,
  type ConverseCommandOutput,
} from "@aws-sdk/client-bedrock-runtime";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { AppError, appError } from "@/domain/errors";
import { candidateSchema, companyRoleSchema, memoryTypeSchema, sopDraftSchema } from "@/domain/schemas";
import type {
  ConflictRelation,
  HydratedMemory,
  MemoryCandidate,
  Message,
  ModelOperationMetadata,
  SopDraft,
} from "@/domain/types";
import type { GeneratedText, ModelGateway } from "@/ports/model-gateway";

interface ConverseSender {
  send(command: ConverseCommand, options?: { abortSignal?: AbortSignal }): Promise<ConverseCommandOutput>;
}

const extractedCandidateSchema = z.object({
  type: memoryTypeSchema,
  title: z.string().min(3).max(120),
  statement: z.string().min(3).max(2000),
  rationale: z.string().max(2000).nullable(),
  rationaleMissing: z.boolean(),
  appliesToRoles: z.array(companyRoleSchema).min(1).max(10),
  tags: z.array(z.string().min(1).max(40)).max(10),
  sensitivity: z.enum(["PUBLIC", "INTERNAL", "CONFIDENTIAL"]),
  confidence: z.number().min(0).max(1),
  relation: z.enum(["UNRELATED", "DUPLICATE", "UPDATE", "CONTRADICTION", "EXCEPTION"]),
  relatedMemoryIds: z.array(z.string().min(1).max(128)).max(10),
  sourceMessageIds: z.array(z.string().min(1).max(128)).min(1).max(10),
  evidenceExcerpt: z.string().min(1).max(300),
});
const extractionSchema = z.object({ candidates: z.array(extractedCandidateSchema).max(5) });
const onboardingExtractedCandidateSchema = extractedCandidateSchema.omit({ sourceMessageIds: true });
const onboardingExtractionSchema = z.object({ candidates: z.array(onboardingExtractedCandidateSchema).max(12) });
const conflictSchema = z.object({
  relation: z.enum(["UNRELATED", "DUPLICATE", "UPDATE", "CONTRADICTION", "EXCEPTION"]),
  relatedMemoryIds: z.array(z.string().min(1).max(128)).max(10),
  summary: z.string().min(1).max(500),
  clarificationQuestion: z.string().min(1).max(500).nullable(),
  confidence: z.number().min(0).max(1),
});

interface PromptTemplate { body: string; version: string; }
interface Invocation { text: string; metadata: ModelOperationMetadata; }

function loadPrompt(name: string): PromptTemplate {
  const body = readFileSync(join(process.cwd(), "prompts", `${name}.md`), "utf8");
  const version = /^version:\s*(.+)$/m.exec(body)?.[1]?.trim();
  if (!version) throw appError("CONFIGURATION_ERROR");
  return { body, version };
}

function memoryContext(memories: HydratedMemory[]): string {
  return JSON.stringify(memories.map(({ record, version }) => ({
    memoryId: record.id,
    version: version.version,
    type: record.type,
    title: version.title,
    statement: version.statement,
    rationale: version.rationale,
    roles: record.appliesToRoles,
    sensitivity: record.sensitivity,
  })));
}

function jsonText(value: string): string {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(value);
  return (fenced?.[1] ?? value).trim();
}

function validatedCitations(text: string, memories: HydratedMemory[]): GeneratedText {
  const allowed = new Map(memories.map((memory) => [
    `${memory.record.id}:v${memory.version.version}`,
    memory.record.id,
  ]));
  const sourceMemoryIds: string[] = [];
  const content = text.replace(/\[\[memory:([^:\]]+):v(\d+)\]\]/g, (_marker, id: string, version: string) => {
    const valid = allowed.get(`${id}:v${version}`);
    if (valid && !sourceMemoryIds.includes(valid)) sourceMemoryIds.push(valid);
    return "";
  }).replace(/\s+([.,])/g, "$1").trim();
  return { content, sourceMemoryIds };
}

export class BedrockModelGateway implements ModelGateway {
  constructor(
    private readonly client: ConverseSender,
    private readonly modelId: string,
    private readonly timeoutMs = 25_000,
  ) {}

  async generateMarketingResponse(input: {
    message: string;
    approvedMemories: HydratedMemory[];
  }): Promise<GeneratedText> {
    const result = await this.invoke("marketing-assistant", [
      "<approved-memory-data>", memoryContext(input.approvedMemories), "</approved-memory-data>",
      "<owner-request>", input.message, "</owner-request>",
    ].join("\n"));
    return { ...validatedCitations(result.text, input.approvedMemories), metadata: result.metadata };
  }

  async generateEmployeeResponse(input: {
    question: string;
    approvedMemories: HydratedMemory[];
  }): Promise<GeneratedText> {
    const result = await this.invoke("employee-assistant", [
      "<approved-memory-data>", memoryContext(input.approvedMemories), "</approved-memory-data>",
      "<employee-question>", input.question, "</employee-question>",
    ].join("\n"));
    return { ...validatedCitations(result.text, input.approvedMemories), metadata: result.metadata };
  }

  async generateProofResponse(input: {
    question: string;
    approvedMemories: HydratedMemory[];
  }): Promise<GeneratedText> {
    return this.generateEmployeeResponse(input);
  }

  async extractCandidate(input: {
    ownerMessage: Message;
    createdBy: string;
  }): Promise<MemoryCandidate | null> {
    const result = await this.invokeStructured("memory-extractor", JSON.stringify({
      messages: [{ id: input.ownerMessage.id, content: input.ownerMessage.content }],
      approvedMemories: [],
    }), extractionSchema);
    const extracted = result.value.candidates[0];
    if (!extracted) return null;
    return candidateSchema.parse({
      id: `candidate-${crypto.randomUUID()}`,
      version: 1,
      companyId: input.ownerMessage.companyId,
      conversationId: input.ownerMessage.conversationId,
      type: extracted.type,
      title: extracted.title,
      statement: extracted.statement,
      rationale: extracted.rationale,
      rationaleMissing: extracted.rationaleMissing,
      appliesToRoles: extracted.appliesToRoles,
      tags: extracted.tags,
      sensitivity: extracted.sensitivity,
      sourceRefs: [{
        sourceId: `source-${input.ownerMessage.id}`,
        label: "Owner conversation",
        messageId: input.ownerMessage.id,
        excerpt: extracted.evidenceExcerpt,
      }],
      confidence: extracted.confidence,
      relation: extracted.relation,
      relatedMemoryIds: extracted.relatedMemoryIds,
      status: "PROPOSED",
      extractionPromptVersion: result.metadata.promptVersion,
      modelId: result.metadata.modelId,
      createdBy: input.createdBy,
      createdAt: input.ownerMessage.createdAt,
    });
  }

  async extractOnboardingCandidates(input: {
    companyId: string;
    createdBy: string;
    proofQuestion: string;
    source: { sourceId: string; label: string; content: string };
  }): Promise<MemoryCandidate[]> {
    const result = await this.invokeStructured("onboarding-extractor", JSON.stringify({
      proofQuestion: input.proofQuestion,
      source: { id: input.source.sourceId, title: input.source.label, content: input.source.content },
    }), onboardingExtractionSchema);
    const createdAt = new Date().toISOString();
    return result.value.candidates.map((extracted) => candidateSchema.parse({
      id: `candidate-${crypto.randomUUID()}`,
      version: 1,
      companyId: input.companyId,
      scope: { level: "COMPANY" },
      type: extracted.type,
      title: extracted.title,
      statement: extracted.statement,
      rationale: extracted.rationale,
      rationaleMissing: extracted.rationaleMissing,
      appliesToRoles: extracted.appliesToRoles,
      tags: extracted.tags,
      sensitivity: extracted.sensitivity,
      sourceRefs: [{
        sourceId: input.source.sourceId,
        label: input.source.label,
        excerpt: extracted.evidenceExcerpt,
      }],
      confidence: extracted.confidence,
      relation: extracted.relation,
      relatedMemoryIds: extracted.relatedMemoryIds,
      status: "PROPOSED",
      extractionPromptVersion: result.metadata.promptVersion,
      modelId: result.metadata.modelId,
      createdBy: input.createdBy,
      createdAt,
    }));
  }

  async classifyRelationship(input: {
    candidate: MemoryCandidate;
    approvedMemories: HydratedMemory[];
  }): Promise<{
    relation: ConflictRelation;
    relatedMemoryIds: string[];
    summary: string;
    clarificationQuestion: string | null;
    confidence: number;
    metadata?: ModelOperationMetadata;
  }> {
    const result = await this.invokeStructured("conflict-classifier", JSON.stringify({
      candidate: input.candidate,
      approvedMemories: JSON.parse(memoryContext(input.approvedMemories)) as unknown,
    }), conflictSchema);
    const allowed = new Set(input.approvedMemories.map((memory) => memory.record.id));
    return {
      ...result.value,
      relatedMemoryIds: result.value.relatedMemoryIds.filter((id) => allowed.has(id)),
      metadata: result.metadata,
    };
  }

  async generateSop(input: { request: string; approvedMemories: HydratedMemory[] }): Promise<SopDraft> {
    const result = await this.invokeStructured(
      "operations-assistant",
      JSON.stringify({
        request: input.request,
        approvedMemories: JSON.parse(memoryContext(input.approvedMemories)) as unknown,
      }),
      sopDraftSchema,
    );
    const allowed = new Set(input.approvedMemories.map((memory) => `${memory.record.id}:v${memory.version.version}`));
    return {
      ...result.value,
      sourceMemories: result.value.sourceMemories.filter((source) =>
        allowed.has(`${source.memoryId}:v${source.version}`),
      ),
    };
  }

  private async invokeStructured<T>(
    promptName: string,
    input: string,
    schema: z.ZodType<T>,
  ): Promise<{ value: T; metadata: ModelOperationMetadata }> {
    const first = await this.invoke(promptName, input);
    const parsed = this.parse(first.text, schema);
    if (parsed.success) return { value: parsed.data, metadata: first.metadata };
    const repair = await this.invoke(promptName, [
      "Repair the following output. Return valid JSON only.",
      `<validation-errors>${z.prettifyError(parsed.error)}</validation-errors>`,
      `<original-output>${first.text}</original-output>`,
    ].join("\n"));
    const repaired = this.parse(repair.text, schema);
    if (!repaired.success) throw appError("MODEL_OUTPUT_INVALID", false, repaired.error);
    return { value: repaired.data, metadata: repair.metadata };
  }

  private parse<T>(text: string, schema: z.ZodType<T>): z.ZodSafeParseResult<T> {
    try {
      return schema.safeParse(JSON.parse(jsonText(text)) as unknown);
    } catch (error) {
      return schema.safeParse({ parseError: error instanceof Error ? error.name : "invalid-json" });
    }
  }

  private async invoke(promptName: string, input: string): Promise<Invocation> {
    const prompt = loadPrompt(promptName);
    const started = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.client.send(new ConverseCommand({
        modelId: this.modelId,
        system: [{ text: prompt.body }],
        messages: [{ role: "user", content: [{ text: input }] }],
        inferenceConfig: { maxTokens: 2_500, temperature: 0.1 },
      }), { abortSignal: controller.signal });
      const text = response.output?.message?.content?.flatMap((block) => block.text ? [block.text] : []).join("\n");
      if (!text) throw appError("MODEL_OUTPUT_INVALID");
      const metadata: ModelOperationMetadata = {
        modelId: this.modelId,
        promptVersion: prompt.version,
        latencyMs: Date.now() - started,
        inputTokens: response.usage?.inputTokens,
        outputTokens: response.usage?.outputTokens,
        providerRequestId: response.$metadata.requestId,
      };
      console.info(JSON.stringify({ event: "model_operation", operation: promptName, ...metadata }));
      return { text, metadata };
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (controller.signal.aborted) throw appError("PROVIDER_TIMEOUT", true, error);
      const name = error instanceof Error ? error.name : "UnknownProviderError";
      if (["AccessDeniedException", "ResourceNotFoundException", "ValidationException", "ModelNotReadyException"].includes(name)) {
        throw appError("MODEL_UNAVAILABLE", name === "ModelNotReadyException", error);
      }
      throw appError("MODEL_UNAVAILABLE", true, error);
    } finally {
      clearTimeout(timeout);
    }
  }
}
