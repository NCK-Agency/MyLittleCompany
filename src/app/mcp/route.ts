import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { env } from "@/lib/env";
import { createMcpServer } from "@/mcp/server";
import { membershipService, oauthService } from "@/server/container";

function challenge(status = 401): Response {
  const metadata = `${env.APP_BASE_URL.replace(/\/$/, "")}/.well-known/oauth-protected-resource`;
  return Response.json(
    { error: "unauthorized", error_description: "Connect a My Little Company account to use this MCP server." },
    { status, headers: { "WWW-Authenticate": `Bearer resource_metadata="${metadata}"`, "Cache-Control": "no-store" } },
  );
}

async function authenticate(request: Request): Promise<AuthInfo | null> {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  const rawToken = authorization.slice("Bearer ".length).trim();
  if (!rawToken) return null;
  const identity = await oauthService.verifyAccessToken(rawToken);
  const actor = await membershipService.resolveActor(identity.identityProvider, identity.identitySubject);
  return {
    token: rawToken,
    clientId: identity.clientId,
    scopes: identity.scopes,
    expiresAt: identity.expiresAt,
    resource: new URL(identity.resource),
    extra: { actor },
  };
}

async function handle(request: Request): Promise<Response> {
  if (env.MCP_ENABLED !== "true") return new Response("Not found", { status: 404 });
  try {
    const authInfo = await authenticate(request);
    if (!authInfo) return challenge();
    const server = createMcpServer();
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    await server.connect(transport);
    return await transport.handleRequest(request, { authInfo });
  } catch {
    return challenge();
  }
}

export const GET = handle;
export const POST = handle;
export const DELETE = handle;
