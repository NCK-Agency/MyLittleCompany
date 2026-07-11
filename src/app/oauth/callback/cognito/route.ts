import { env } from "@/lib/env";
import { loginPathForMode } from "@/lib/auth-navigation";

export async function GET(request: Request): Promise<Response> {
  if (env.MCP_ENABLED !== "true") return new Response("Not found", { status: 404 });
  const url = new URL(request.url);
  const returnTo = url.searchParams.get("returnTo");
  const safeReturnTo = returnTo?.startsWith("/oauth/authorize?") ? returnTo : "/workspace";
  const loginPath = loginPathForMode(env.AUTH_MODE);
  return Response.redirect(new URL(`${loginPath}?returnTo=${encodeURIComponent(safeReturnTo)}`, url.origin), 302);
}
