import { env } from "@/lib/env";
import { oauthErrorResponse, noStoreJson } from "@/oauth/http";
import { oauthService } from "@/server/container";

const attempts = new Map<string, { count: number; resetAt: number }>();

function registrationAllowed(request: Request): boolean {
  const key = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const now = Date.now();
  const current = attempts.get(key);
  if (!current || current.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (current.count >= 20) return false;
  current.count += 1;
  return true;
}

export async function POST(request: Request): Promise<Response> {
  if (env.MCP_ENABLED !== "true") return new Response("Not found", { status: 404 });
  if (!registrationAllowed(request)) {
    return noStoreJson({ error: "temporarily_unavailable", error_description: "Registration rate limit exceeded." }, { status: 429 });
  }
  try {
    return noStoreJson(await oauthService.register(await request.json()), { status: 201 });
  } catch (error) {
    return oauthErrorResponse(error);
  }
}
