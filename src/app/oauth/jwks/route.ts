import { env } from "@/lib/env";
import { noStoreJson } from "@/oauth/http";
import { oauthService } from "@/server/container";

export async function GET(): Promise<Response> {
  if (env.MCP_ENABLED !== "true") return new Response("Not found", { status: 404 });
  return noStoreJson(await oauthService.jwks());
}
