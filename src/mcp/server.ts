import { createHash, randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import type { ServerNotification, ServerRequest } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { canAccess } from "@/domain/authorization";
import type { ActorContext, KnowledgeScope } from "@/domain/types";
import { env } from "@/lib/env";
import type { McpConsentScope } from "@/oauth/types";
import { connectedSuggestionService, memoryService, retrievalService } from "@/server/container";

const securitySchemes = {
  read: [{ type: "oauth2", scopes: ["knowledge:read"] }],
  suggest: [{ type: "oauth2", scopes: ["knowledge:suggest"] }],
};

const scopeSchema = z.object({
  level: z.enum(["COMPANY", "DEPARTMENT"]).describe("Whether the suggestion applies to the entire company or one department."),
  organizationalUnitId: z.string().min(1).max(128).optional()
    .describe("Required for DEPARTMENT scope. Use the department identifier already established in the conversation."),
}).optional().describe("Where the suggested knowledge applies. Defaults to COMPANY, which requires company-level SUGGEST access.");

type ToolExtra = RequestHandlerExtra<ServerRequest, ServerNotification>;

function context(extra: ToolExtra, requiredScope: McpConsentScope): ActorContext {
  if (!extra.authInfo?.scopes.includes(requiredScope)) throw new Error(`OAuth scope ${requiredScope} is required.`);
  const actor = extra.authInfo.extra?.actor;
  if (!actor || typeof actor !== "object") throw new Error("An active My Little Company membership is required.");
  return actor as ActorContext;
}

function canonicalUrl(memoryId: string): string {
  return `${env.APP_BASE_URL.replace(/\/$/, "")}/playbook/${encodeURIComponent(memoryId)}`;
}

function textResult<T extends Record<string, unknown>>(payload: T): {
  content: [{ type: "text"; text: string }];
  structuredContent: T;
} {
  return { content: [{ type: "text", text: JSON.stringify(payload) }], structuredContent: payload };
}

async function observed<T>(
  toolName: string,
  actor: ActorContext,
  operation: () => Promise<T>,
  detail: (result: T) => Record<string, unknown>,
): Promise<T> {
  const startedAt = performance.now();
  const requestId = randomUUID();
  const pseudonym = (value: string): string => createHash("sha256").update(value).digest("hex").slice(0, 12);
  try {
    const result = await operation();
    console.info(JSON.stringify({
      event: "MCP_TOOL_COMPLETE",
      toolName,
      requestId,
      actor: pseudonym(actor.userId),
      company: pseudonym(actor.companyId),
      latencyMs: Math.round(performance.now() - startedAt),
      ...detail(result),
    }));
    return result;
  } catch (error) {
    console.error(JSON.stringify({
      event: "MCP_TOOL_FAILED",
      toolName,
      requestId,
      actor: pseudonym(actor.userId),
      company: pseudonym(actor.companyId),
      latencyMs: Math.round(performance.now() - startedAt),
      errorCode: error instanceof Error ? error.message : "UNKNOWN",
    }));
    throw error;
  }
}

export function createMcpServer(): McpServer {
  const server = new McpServer(
    {
      name: "my-little-company",
      title: "My Little Company",
      version: "0.1.0",
      description: "Approved company knowledge and reviewable suggestions for your AI conversations.",
      websiteUrl: env.APP_BASE_URL,
      icons: [{
        src: `${env.APP_BASE_URL.replace(/\/$/, "")}/brand/mlc-app-icon.svg`,
        mimeType: "image/svg+xml",
        sizes: ["512x512"],
      }],
    },
    {
      instructions: [
        "Use My Little Company as the authoritative source only for approved company knowledge.",
        "Before making a company-specific claim, call search; call fetch when the full rule, rationale, or citation is needed.",
        "When the user states a lasting rule, decision, fact, lesson, or process, offer to call suggest_company_knowledge.",
        "A proposed suggestion is never approved truth and must not be presented as policy.",
        "Never approve knowledge through this app. Approval happens in My Little Company's Review area.",
      ].join(" "),
    },
  );

  server.registerTool("search", {
    title: "Search company knowledge",
    description: "Use this when the user asks about company-specific facts, policies, decisions, lessons, brand rules, or procedures. Searches only approved, current, indexed knowledge the connected user may read.",
    inputSchema: {
      query: z.string().trim().min(1).max(1000).describe("A focused natural-language query for the company knowledge to find."),
    },
    outputSchema: {
      results: z.array(z.object({ id: z.string(), title: z.string(), url: z.url() })),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    _meta: {
      securitySchemes: securitySchemes.read,
      "openai/toolInvocation/invoking": "Searching the Company Playbook…",
      "openai/toolInvocation/invoked": "Company knowledge found",
    },
  }, async ({ query }, extra) => {
    const actor = context(extra, "knowledge:read");
    const payload = await observed("search", actor, async () => {
      const memories = await retrievalService.retrieve(query, actor);
      return {
        results: memories.map((memory) => ({
          id: memory.record.id,
          title: memory.version.title,
          url: canonicalUrl(memory.record.id),
        })),
      };
    }, (result) => ({ resultCount: result.results.length }));
    return textResult(payload);
  });

  server.registerTool("fetch", {
    title: "Fetch company knowledge",
    description: "Use this after search when the full approved statement, rationale, metadata, or citation is needed. Accepts only an ID returned by search.",
    inputSchema: {
      id: z.string().min(1).max(128).describe("The exact company-knowledge ID returned by search."),
    },
    outputSchema: {
      id: z.string(),
      title: z.string(),
      text: z.string(),
      url: z.url(),
      metadata: z.record(z.string(), z.string()).optional(),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    _meta: {
      securitySchemes: securitySchemes.read,
      "openai/toolInvocation/invoking": "Opening approved company knowledge…",
      "openai/toolInvocation/invoked": "Approved knowledge opened",
    },
  }, async ({ id }, extra) => {
    const actor = context(extra, "knowledge:read");
    const payload = await observed("fetch", actor, async () => {
      const memory = await memoryService.getMemory(id, actor);
      if (!memory) throw new Error("Company knowledge was not found or is not available to this user.");
      return {
        id: memory.record.id,
        title: memory.version.title,
        text: [
          memory.version.statement,
          memory.version.rationale ? `Rationale: ${memory.version.rationale}` : "Rationale: Not recorded.",
        ].join("\n\n"),
        url: canonicalUrl(memory.record.id),
        metadata: {
          type: memory.record.type,
          scope: memory.record.scope.level,
          approvedAt: memory.version.approvedAt,
          version: String(memory.version.version),
        },
      };
    }, () => ({ resultCount: 1 }));
    return textResult(payload);
  });

  server.registerTool("suggest_company_knowledge", {
    title: "Suggest company knowledge",
    description: "Use this only when the user wants a lasting company rule, fact, decision, lesson, or process proposed for human review. This write never approves knowledge and never makes it authoritative.",
    inputSchema: {
      content: z.string().trim().min(3).max(4000).describe("The smallest evidence excerpt that contains the durable company knowledge."),
      idempotencyKey: z.string().min(8).max(128).describe("A stable unique key reused when retrying the same suggestion."),
      scope: scopeSchema,
    },
    outputSchema: {
      status: z.enum(["NO_DURABLE_KNOWLEDGE", "PROPOSED"]),
      message: z.string().optional(),
      candidate: z.object({
        id: z.string(),
        title: z.string(),
        statement: z.string(),
        relation: z.enum(["UNRELATED", "DUPLICATE", "UPDATE", "CONTRADICTION", "EXCEPTION"]),
        reviewUrl: z.url(),
      }).optional(),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    _meta: {
      securitySchemes: securitySchemes.suggest,
      "openai/toolInvocation/invoking": "Preparing a company knowledge suggestion…",
      "openai/toolInvocation/invoked": "Suggestion sent to Review",
    },
  }, async ({ content, idempotencyKey, scope }, extra) => {
    const actor = context(extra, "knowledge:suggest");
    const requestedScope: KnowledgeScope = scope ?? { level: "COMPANY" };
    if (!canAccess(actor, "SUGGEST", requestedScope)) throw new Error("The connected user cannot suggest knowledge in this scope.");
    const payload = await observed("suggest_company_knowledge", actor, async () => {
      const result = await connectedSuggestionService.suggest({ content, idempotencyKey, scope: requestedScope }, actor);
      if (result.status === "NO_DURABLE_KNOWLEDGE") return result;
      return {
        status: "PROPOSED" as const,
        candidate: {
          id: result.candidate.id,
          title: result.candidate.title,
          statement: result.candidate.statement,
          relation: result.candidate.relation,
          reviewUrl: `${env.APP_BASE_URL.replace(/\/$/, "")}/review?candidate=${encodeURIComponent(result.candidate.id)}`,
        },
      };
    }, (result) => ({
      resultCount: result.status === "PROPOSED" ? 1 : 0,
      candidateId: result.status === "PROPOSED" ? result.candidate.id : undefined,
    }));
    return textResult(payload);
  });

  return server;
}
