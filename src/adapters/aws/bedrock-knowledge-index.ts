import {
  BedrockAgentClient,
  GetKnowledgeBaseDocumentsCommand,
  IngestKnowledgeBaseDocumentsCommand,
} from "@aws-sdk/client-bedrock-agent";
import {
  BedrockAgentRuntimeClient,
  RetrieveCommand,
  type RetrievalFilter,
} from "@aws-sdk/client-bedrock-agent-runtime";
import { createHash } from "node:crypto";
import { appError } from "@/domain/errors";
import type {
  ActorContext,
  CanonicalMemoryDocument,
  HydratedMemory,
  KnowledgeIndexHit,
} from "@/domain/types";
import type { KnowledgeIndex } from "@/ports/knowledge-index";

function stringMetadata(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function numberMetadata(value: unknown): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : undefined;
}

function stringListMetadata(value: unknown): string[] | undefined {
  return Array.isArray(value) && value.length > 0
    && value.every((item) => typeof item === "string" && item.length > 0)
    ? value
    : undefined;
}

export class BedrockKnowledgeIndex implements KnowledgeIndex {
  constructor(
    private readonly agent: BedrockAgentClient,
    private readonly runtime: BedrockAgentRuntimeClient,
    private readonly knowledgeBaseId: string,
    private readonly dataSourceId: string,
  ) {}

  async upsert(
    memory: HydratedMemory,
    document: CanonicalMemoryDocument,
  ): Promise<{ documentId: string }> {
    const documentId = `${memory.record.companyId}:${memory.record.id}:v${memory.version.version}`;
    await this.agent.send(new IngestKnowledgeBaseDocumentsCommand({
      knowledgeBaseId: this.knowledgeBaseId,
      dataSourceId: this.dataSourceId,
      clientToken: createHash("sha256").update(documentId).digest("hex"),
      documents: [{
        content: {
          dataSourceType: "S3",
          s3: { s3Location: { uri: document.uri } },
        },
        metadata: {
          type: "IN_LINE_ATTRIBUTE",
          inlineAttributes: [
            { key: "companyId", value: { type: "STRING", stringValue: memory.record.companyId } },
            { key: "memoryId", value: { type: "STRING", stringValue: memory.record.id } },
            { key: "version", value: { type: "NUMBER", numberValue: memory.version.version } },
            { key: "type", value: { type: "STRING", stringValue: memory.record.type } },
            { key: "status", value: { type: "STRING", stringValue: memory.record.status } },
            { key: "roleScopes", value: { type: "STRING_LIST", stringListValue: memory.record.appliesToRoles } },
            { key: "sensitivity", value: { type: "STRING", stringValue: memory.record.sensitivity } },
          ],
        },
      }],
    }));
    await this.waitUntilIndexed(document.uri);
    return { documentId };
  }

  async retrieve(query: string, actor: ActorContext, requestedRoles = actor.roles): Promise<KnowledgeIndexHit[]> {
    const filters: RetrievalFilter[] = [
      { equals: { key: "companyId", value: actor.companyId } },
      { equals: { key: "status", value: "APPROVED" } },
    ];
    const filterRoles = requestedRoles.filter((role) => role !== "OWNER");
    if (filterRoles.length > 0) {
      filters.push({
        orAll: filterRoles.map((role) => ({ listContains: { key: "roleScopes", value: role } })),
      });
    }
    const response = await this.runtime.send(new RetrieveCommand({
      knowledgeBaseId: this.knowledgeBaseId,
      retrievalQuery: { text: query },
      retrievalConfiguration: {
        vectorSearchConfiguration: {
          numberOfResults: 8,
          filter: { andAll: filters },
        },
      },
    }));
    return (response.retrievalResults ?? []).flatMap((result) => {
      const metadata = result.metadata ?? {};
      const companyId = stringMetadata(metadata.companyId);
      const memoryId = stringMetadata(metadata.memoryId);
      const version = numberMetadata(metadata.version);
      const status = stringMetadata(metadata.status);
      const roleScopes = stringListMetadata(metadata.roleScopes);
      const sensitivity = stringMetadata(metadata.sensitivity);
      if (companyId !== actor.companyId || status !== "APPROVED"
        || !memoryId || !version || !roleScopes || !sensitivity) return [];
      return [{
        memoryId,
        version,
        score: result.score,
        metadata: {
          companyId,
          status,
          roleScopes,
          sensitivity,
        },
      }];
    });
  }

  private async waitUntilIndexed(uri: string): Promise<void> {
    for (let attempt = 0; attempt < 24; attempt += 1) {
      const response = await this.agent.send(new GetKnowledgeBaseDocumentsCommand({
        knowledgeBaseId: this.knowledgeBaseId,
        dataSourceId: this.dataSourceId,
        documentIdentifiers: [{ dataSourceType: "S3", s3: { uri } }],
      }));
      const status = response.documentDetails?.[0]?.status;
      if (status === "INDEXED") return;
      if (["FAILED", "METADATA_UPDATE_FAILED", "IGNORED", "NOT_FOUND"].includes(status ?? "")) {
        throw appError("INDEX_FAILED", true);
      }
      await new Promise((resolve) => setTimeout(resolve, 750));
    }
    throw appError("INDEX_FAILED", true);
  }
}
