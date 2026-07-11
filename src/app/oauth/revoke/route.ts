import { env } from "@/lib/env";
import { noStoreJson } from "@/oauth/http";
import { oauthService } from "@/server/container";

export async function POST(request: Request): Promise<Response> {
  if (env.MCP_ENABLED !== "true") return new Response("Not found", { status: 404 });
  const form = await request.formData();
  const token = form.get("token");
  if (typeof token === "string") await oauthService.revoke(token);
  return noStoreJson({});
}
