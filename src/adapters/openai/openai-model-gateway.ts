import type OpenAI from "openai";
import {
  APIConnectionError,
  APIConnectionTimeoutError,
  APIError,
  RateLimitError,
} from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { AppError, appError } from "@/domain/errors";
import { candidateSchema, companyRoleSchema, memoryTypeSchema, sopDraftSchema } from "@/domain/schemas";
import type {
  AssistantModelTier,
  ConflictRelation,
  HydratedMemory,
  MemoryCandidate,
  Message,
  ModelOperationMetadata,
  SopDraft,
} from "@/domain/types";
import type { GeneratedText, ModelGateway } from "@/ports/model-gateway";

const MAX_OUTPUT_TOKENS = 4_000;
const DEFAULT_TIMEOUT_MS = 25_000;

const generatedTextSchema = z.object({
  content: z.string().min(1).max(20_000),
}).strict();

const extractedCandidateSchema = z.object({
  type: memoryTypeSchema,
  title: z.string().min(3).max(120),
  statement: z.string().min(3).max(2_000),
  rationale: z.string().max(2_000).nullable(),
  rationaleMissing: z.boolean(),
  appliesToRoles: z.array(companyRoleSchema).min(1).max(10),
  tags: z.array(z.string().min(1).max(40)).max(10),
  sensitivity: z.enum(["PUBLIC", "INTERNAL", "CONFIDENTIAL"]),
  confidence: z.number().min(0).max(1),
  relation: z.enum(["UNRELATED", "DUPLICATE", "UPDATE", "CONTRADICTION", "EXCEPTION"]),
  relatedMemoryIds: z.array(z.string().min(1).max(128)).max(10),
  sourceMessageIds: z.array(z.string().min(1).max(128)).min(1).max(10),
  evidenceExcerpt: z.string().min(1).max(300),
}).strict();

const extractionSchema = z.object({
  candidates: z.array(extractedCandidateSchema).max(5),
}).strict();

const onboardingExtractedCandidateSchema = extractedCandidateSchema.omit({ sourceMessageIds: true });
const onboardingExtractionSchema = z.object({
  candidates: z.array(onboardingExtractedCandidateSchema).max(12),
}).strict();

const conflictSchema = z.object({
  relation: z.enum(["UNRELATED", "DUPLICATE", "UPDATE", "CONTRADICTION", "EXCEPTION"]),
  relatedMemoryIds: z.array(z.string().min(1).max(128)).max(10),
  summary: z.string().min(1).max(500),
  clarificationQuestion: z.string().min(1).max(500).nullable(),
  confidence: z.number().min(0).max(1),
}).strict();

const sopOutputSchema = sopDraftSchema.strict();

interface PromptTemplate {
  body: string;
  version: string;
}

interface ModelSelection {
  modelId: string;
  tier: AssistantModelTier;
}

interface StructuredInvocation<T> {
  value: T;
  metadata: ModelOperationMetadata;
}

interface ResponseWithRequestId {
  _request_id?: string | null;
}

export interface OpenAICompatibleClient {
  responses: Pick<OpenAI["responses"], "parse">;
}

export type ModelSelectionResolver = (companyId: string) => Promise<ModelSelection>;

class StructuredOutputError extends Error {
  constructor(
    readonly details: string,
    readonly providerRequestId?: string,
    options?: { cause?: unknown },
  ) {
    super("MODEL_OUTPUT_INVALID", { cause: options?.cause });
    this.name = "StructuredOutputError";
  }
}

class ProviderResponseError extends Error {
  constructor(
    readonly responseCode: string,
    readonly requestID: string | undefined,
    readonly transient: boolean,
    readonly rateLimited: boolean,
    readonly timedOut: boolean,
  ) {
    super("MODEL_UNAVAILABLE");
    this.name = "ProviderResponseError";
  }
}

function loadPrompt(name: string): PromptTemplate {
  try {
    const body = readFileSync(join(process.cwd(), "prompts", `${name}.md`), "utf8");
    const version = /^version:\s*(.+)$/m.exec(body)?.[1]?.trim();
    if (!version) throw appError("CONFIGURATION_ERROR");
    return { body, version };
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw appError("CONFIGURATION_ERROR", false, error);
  }
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

function outputSchemaName(promptName: string): string {
  return `${promptName.replace(/[^a-zA-Z0-9_-]/g, "_")}_output`;
}

function responseRequestId(response: ResponseWithRequestId): string | undefined {
  return response._request_id ?? undefined;
}

function providerRequestId(error: unknown): string | undefined {
  if (error instanceof APIError) return error.requestID ?? undefined;
  if (!error || typeof error !== "object") return undefined;
  const candidate = error as { requestID?: unknown; request_id?: unknown; _request_id?: unknown };
  for (const value of [candidate.requestID, candidate.request_id, candidate._request_id]) {
    if (typeof value === "string" && value.length > 0) return value;
  }
  return undefined;
}

function providerStatus(error: unknown): number | undefined {
  if (error instanceof APIError) return error.status;
  if (!error || typeof error !== "object") return undefined;
  const status = (error as { status?: unknown }).status;
  return typeof status === "number" ? status : undefined;
}

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : "UnknownProviderError";
}

function isTimeoutError(error: unknown): boolean {
  return error instanceof APIConnectionTimeoutError
    || error instanceof ProviderResponseError && error.timedOut
    || errorName(error) === "APIConnectionTimeoutError"
    || errorName(error) === "TimeoutError";
}

function isRateLimitError(error: unknown): boolean {
  return error instanceof RateLimitError
    || error instanceof ProviderResponseError && error.rateLimited
    || providerStatus(error) === 429
    || errorName(error) === "RateLimitError";
}

function isTransientProviderError(error: unknown): boolean {
  if (error instanceof ProviderResponseError) return error.transient;
  if (isTimeoutError(error) || isRateLimitError(error)) return true;
  if (error instanceof APIConnectionError || errorName(error) === "APIConnectionError") return true;
  const status = providerStatus(error);
  return status === 408 || status === 409 || (status !== undefined && status >= 500);
}

function isStructuredParseError(error: unknown): boolean {
  return error instanceof z.ZodError
    || error instanceof SyntaxError
    || errorName(error) === "LengthFinishReasonError";
}

function structuredErrorDetails(error: unknown): string {
  if (error instanceof z.ZodError) return z.prettifyError(error);
  if (error instanceof SyntaxError) return "The provider response was not valid JSON.";
  return "The provider response did not match the required output schema.";
}

function mapProviderError(error: unknown): AppError {
  const requestId = providerRequestId(error);
  if (isTimeoutError(error)) {
    return new AppError("PROVIDER_TIMEOUT", true, { cause: error, providerRequestId: requestId });
  }
  if (isRateLimitError(error)) {
    return new AppError("RATE_LIMITED", true, { cause: error, providerRequestId: requestId });
  }
  return new AppError("MODEL_UNAVAILABLE", isTransientProviderError(error), {
    cause: error,
    providerRequestId: requestId,
  });
}

function providerResponseError(
  code: string,
  requestId: string | undefined,
): ProviderResponseError {
  return new ProviderResponseError(
    code,
    requestId,
    code === "server_error" || code === "rate_limit_exceeded" || code === "vector_store_timeout",
    code === "rate_limit_exceeded",
    code === "vector_store_timeout",
  );
}

function hasRefusal(output: Array<unknown>): boolean {
  return output.some((item) => {
    if (!item || typeof item !== "object" || (item as { type?: unknown }).type !== "message") return false;
    const content = (item as { content?: unknown }).content;
    return Array.isArray(content) && content.some((part) =>
      part !== null && typeof part === "object" && (part as { type?: unknown }).type === "refusal",
    );
  });
}

function validatedCitations(text: string, memories: HydratedMemory[]): GeneratedText {
  const allowed = new Map(memories.map((memory) => [
    `${memory.record.id}:v${memory.version.version}`,
    memory.record.id,
  ]));
  const sourceMemoryIds: string[] = [];
  let unknownCitationCount = 0;
  const content = text.replace(/\[\[memory:([^:\]]+):v(\d+)\]\]/g, (_marker, id: string, version: string) => {
    const valid = allowed.get(`${id}:v${version}`);
    if (valid && !sourceMemoryIds.includes(valid)) sourceMemoryIds.push(valid);
    if (!valid) unknownCitationCount += 1;
    return "";
  }).replace(/\s+([.,])/g, "$1").trim();
  if (unknownCitationCount > 0) {
    console.warn(JSON.stringify({
      event: "model_output_quality_failure",
      code: "UNKNOWN_MEMORY_CITATION",
      unknownCitationCount,
    }));
  }
  return { content, sourceMemoryIds };
}

export class OpenAIModelGateway implements ModelGateway {
  constructor(
    private readonly client: OpenAICompatibleClient,
    private readonly resolveModel: ModelSelectionResolver,
    private readonly timeoutMs = DEFAULT_TIMEOUT_MS,
  ) {}

  async generateMarketingResponse(input: {
    companyId: string;
    message: string;
    approvedMemories: HydratedMemory[];
  }): Promise<GeneratedText> {
    const result = await this.invokeStructured(
      "marketing-assistant",
      input.companyId,
      [
        "<approved-memory-data>", memoryContext(input.approvedMemories), "</approved-memory-data>",
        "<owner-request>", input.message, "</owner-request>",
      ].join("\n"),
      generatedTextSchema,
    );
    return { ...validatedCitations(result.value.content, input.approvedMemories), metadata: result.metadata };
  }

  async generateEmployeeResponse(input: {
    companyId: string;
    question: string;
    approvedMemories: HydratedMemory[];
  }): Promise<GeneratedText> {
    const result = await this.invokeStructured(
      "employee-assistant",
      input.companyId,
      [
        "<approved-memory-data>", memoryContext(input.approvedMemories), "</approved-memory-data>",
        "<employee-question>", input.question, "</employee-question>",
      ].join("\n"),
      generatedTextSchema,
    );
    return { ...validatedCitations(result.value.content, input.approvedMemories), metadata: result.metadata };
  }

  async generateProofResponse(input: {
    companyId: string;
    question: string;
    approvedMemories: HydratedMemory[];
  }): Promise<GeneratedText> {
    return this.generateEmployeeResponse(input);
  }

  async extractCandidate(input: {
    companyId: string;
    ownerMessage: Message;
    createdBy: string;
  }): Promise<MemoryCandidate | null> {
    const result = await this.invokeStructured(
      "memory-extractor",
      input.companyId,
      JSON.stringify({
        messages: [{ id: input.ownerMessage.id, content: input.ownerMessage.content }],
        approvedMemories: [],
      }),
      extractionSchema,
    );
    const extracted = result.value.candidates[0];
    if (!extracted) return null;
    return candidateSchema.parse({
      id: `candidate-${crypto.randomUUID()}`,
      version: 1,
      companyId: input.companyId,
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
      relatedMemoryIds: [],
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
    const result = await this.invokeStructured(
      "onboarding-extractor",
      input.companyId,
      JSON.stringify({
        proofQuestion: input.proofQuestion,
        source: { id: input.source.sourceId, title: input.source.label, content: input.source.content },
      }),
      onboardingExtractionSchema,
    );
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
      relatedMemoryIds: [],
      status: "PROPOSED",
      extractionPromptVersion: result.metadata.promptVersion,
      modelId: result.metadata.modelId,
      createdBy: input.createdBy,
      createdAt,
    }));
  }

  async classifyRelationship(input: {
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
  }> {
    const result = await this.invokeStructured(
      "conflict-classifier",
      input.companyId,
      JSON.stringify({
        candidate: input.candidate,
        approvedMemories: JSON.parse(memoryContext(input.approvedMemories)) as unknown,
      }),
      conflictSchema,
    );
    const allowed = new Set(input.approvedMemories.map((memory) => memory.record.id));
    return {
      ...result.value,
      relatedMemoryIds: result.value.relatedMemoryIds.filter((id) => allowed.has(id)),
      metadata: result.metadata,
    };
  }

  async generateSop(input: {
    companyId: string;
    request: string;
    approvedMemories: HydratedMemory[];
  }): Promise<SopDraft> {
    const result = await this.invokeStructured(
      "operations-assistant",
      input.companyId,
      JSON.stringify({
        request: input.request,
        approvedMemories: JSON.parse(memoryContext(input.approvedMemories)) as unknown,
      }),
      sopOutputSchema,
    );
    const allowed = new Set(input.approvedMemories.map((memory) =>
      `${memory.record.id}:v${memory.version.version}`,
    ));
    return {
      ...result.value,
      sourceMemories: result.value.sourceMemories.filter((source) =>
        allowed.has(`${source.memoryId}:v${source.version}`),
      ),
      metadata: result.metadata,
    };
  }

  private async invokeStructured<T>(
    promptName: string,
    companyId: string,
    input: string,
    schema: z.ZodType<T>,
  ): Promise<StructuredInvocation<T>> {
    const prompt = loadPrompt(promptName);
    const selection = await this.selectionFor(companyId);
    const started = Date.now();
    try {
      return await this.requestStructured(promptName, prompt, selection, input, schema, started);
    } catch (error) {
      if (!(error instanceof StructuredOutputError)) throw error;
      try {
        return await this.requestStructured(
          promptName,
          prompt,
          selection,
          [
            input,
            "<repair-instructions>",
            "The previous response did not match the required output schema.",
            `Validation details: ${error.details}`,
            "Return one complete replacement response that matches the supplied schema exactly.",
            "</repair-instructions>",
          ].join("\n"),
          schema,
          started,
        );
      } catch (repairError) {
        if (!(repairError instanceof StructuredOutputError)) throw repairError;
        throw new AppError("MODEL_OUTPUT_INVALID", false, {
          cause: repairError,
          providerRequestId: repairError.providerRequestId ?? error.providerRequestId,
        });
      }
    }
  }

  private async requestStructured<T>(
    promptName: string,
    prompt: PromptTemplate,
    selection: ModelSelection,
    input: string,
    schema: z.ZodType<T>,
    started: number,
  ): Promise<StructuredInvocation<T>> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await this.client.responses.parse({
          model: selection.modelId,
          instructions: prompt.body,
          input,
          text: { format: zodTextFormat(schema, outputSchemaName(promptName)) },
          max_output_tokens: MAX_OUTPUT_TOKENS,
          store: false,
        }, {
          maxRetries: 0,
          timeout: this.timeoutMs,
        });
        const requestId = responseRequestId(response as ResponseWithRequestId);
        if (response.error) throw providerResponseError(response.error.code, requestId);
        if (hasRefusal(response.output)) {
          console.warn(JSON.stringify({ event: "model_output_quality_failure", code: "MODEL_REFUSAL" }));
          throw new AppError("MODEL_OUTPUT_INVALID", false, {
            cause: new Error("MODEL_REFUSAL"),
            providerRequestId: requestId,
          });
        }
        if (response.status && response.status !== "completed") {
          throw new StructuredOutputError("The provider response was incomplete.", requestId);
        }
        const parsed = schema.safeParse(response.output_parsed);
        if (!parsed.success) {
          throw new StructuredOutputError(z.prettifyError(parsed.error), requestId, { cause: parsed.error });
        }
        const metadata: ModelOperationMetadata = {
          modelId: typeof response.model === "string" ? response.model : selection.modelId,
          promptVersion: prompt.version,
          latencyMs: Date.now() - started,
          inputTokens: response.usage?.input_tokens,
          outputTokens: response.usage?.output_tokens,
          providerRequestId: requestId,
        };
        console.info(JSON.stringify({
          event: "model_operation",
          operation: promptName,
          modelTier: selection.tier,
          ...metadata,
        }));
        return { value: parsed.data, metadata };
      } catch (error) {
        if (error instanceof AppError || error instanceof StructuredOutputError) throw error;
        if (isStructuredParseError(error)) {
          throw new StructuredOutputError(structuredErrorDetails(error), providerRequestId(error), { cause: error });
        }
        if (attempt === 0 && isTransientProviderError(error)) {
          await new Promise((resolve) => setTimeout(resolve, 250 + Math.floor(Math.random() * 251)));
          continue;
        }
        throw mapProviderError(error);
      }
    }
    throw appError("MODEL_UNAVAILABLE", true);
  }

  private async selectionFor(companyId: string): Promise<ModelSelection> {
    try {
      const selection = await this.resolveModel(companyId);
      if (!selection.modelId.trim()) throw appError("CONFIGURATION_ERROR");
      return { ...selection, modelId: selection.modelId.trim() };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw appError("CONFIGURATION_ERROR", false, error);
    }
  }
}
