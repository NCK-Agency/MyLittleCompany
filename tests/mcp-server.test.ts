// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { resetDemoState } from "@/adapters/local/demo-state";
import { createMcpServer } from "@/mcp/server";
import { env } from "@/lib/env";
import { oauthService } from "@/server/container";
import { ownerActor } from "@/server/actors";
import { POST as mcpPost } from "@/app/mcp/route";
import { createHash } from "node:crypto";

beforeEach(() => resetDemoState());

describe("tool-only MCP server", () => {
  it("publishes exact search/fetch tools plus suggestions, with no approval tool", async () => {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const authInfo: AuthInfo = {
      token: "test-token",
      clientId: "test-client",
      scopes: ["knowledge:read", "knowledge:suggest"],
      resource: new URL("http://localhost:3000/mcp"),
      extra: { actor: ownerActor() },
    };
    const send = clientTransport.send.bind(clientTransport);
    clientTransport.send = (message, options) => send(message, { ...options, authInfo });
    const server = createMcpServer();
    const client = new Client({ name: "contract-test", version: "1.0.0" });
    await server.connect(serverTransport);
    await client.connect(clientTransport);

    expect(client.getServerVersion()).toMatchObject({
      name: "my-little-company",
      title: "My Little Company",
      description: expect.stringContaining("Approved company knowledge"),
      icons: [{ src: "http://localhost:3000/brand/mlc-app-icon.svg", mimeType: "image/svg+xml" }],
    });

    const listed = await client.listTools();
    expect(listed.tools.map((tool) => tool.name)).toEqual(["search", "fetch", "suggest_company_knowledge"]);
    expect(listed.tools.some((tool) => tool.name.includes("approve"))).toBe(false);
    const search = listed.tools.find((tool) => tool.name === "search")!;
    const suggest = listed.tools.find((tool) => tool.name === "suggest_company_knowledge")!;
    expect(search.description).toMatch(/^Use this when/);
    expect(search.inputSchema).toMatchObject({
      type: "object",
      required: ["query"],
      properties: { query: { type: "string" } },
    });
    expect(search.annotations).toMatchObject({ readOnlyHint: true, openWorldHint: false });
    expect(search._meta).toMatchObject({
      securitySchemes: [{ type: "oauth2", scopes: ["knowledge:read"] }],
      "openai/toolInvocation/invoking": "Searching the Company Playbook…",
    });
    expect(suggest.description).toMatch(/^Use this only when/);
    expect(suggest.annotations).toMatchObject({
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    });

    const result = await client.callTool({ name: "search", arguments: { query: "salon" } });
    expect(result.structuredContent).toHaveProperty("results");
    const content = result.content as Array<{ type: string }>;
    expect(content).toHaveLength(1);
    expect(content[0]).toMatchObject({ type: "text" });

    await client.close();
    await server.close();
  });

  it("initializes the authenticated stateless Streamable HTTP route", async () => {
    env.MCP_ENABLED = "true";
    const registration = await oauthService.register({
      client_name: "HTTP contract test",
      redirect_uris: ["http://127.0.0.1:46789/callback"],
    });
    const clientId = String(registration.client_id);
    const verifier = "http-route-pkce-verifier-with-more-than-forty-three-characters";
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    const authorization = await oauthService.validateAuthorizationRequest(new URLSearchParams({
      client_id: clientId,
      redirect_uri: "http://127.0.0.1:46789/callback",
      response_type: "code",
      resource: "http://localhost:3000/mcp",
      scope: "knowledge:read",
      code_challenge: challenge,
      code_challenge_method: "S256",
    }));
    const callback = new URL(await oauthService.authorize(authorization, { provider: "DEMO", subject: "user-owner-demo" }));
    const tokens = await oauthService.exchangeAuthorizationCode({
      code: callback.searchParams.get("code")!,
      clientId,
      redirectUri: authorization.redirectUri,
      codeVerifier: verifier,
      resource: authorization.resource,
    });
    const response = await mcpPost(new Request("http://localhost:3000/mcp", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
        Accept: "application/json, text/event-stream",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: { name: "route-test", version: "1.0.0" },
        },
      }),
    }));
    expect(response.status).toBe(200);
    const payload = await response.json() as { result?: { serverInfo?: { name?: string }; instructions?: string } };
    expect(payload.result?.serverInfo?.name).toBe("my-little-company");
    expect(payload.result?.instructions).toContain("Never approve knowledge through this app");
    env.MCP_ENABLED = "false";
  });
});
