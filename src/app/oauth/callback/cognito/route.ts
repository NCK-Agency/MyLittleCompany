import { env } from "@/lib/env";

export async function GET(request: Request): Promise<Response> {
  if (env.MCP_ENABLED !== "true") return new Response("Not found", { status: 404 });
  const url = new URL(request.url);
  const returnTo = url.searchParams.get("returnTo");
  const safeReturnTo = returnTo?.startsWith("/oauth/authorize?") ? returnTo : "/workspace";
  return Response.redirect(new URL(`/login?returnTo=${encodeURIComponent(safeReturnTo)}`, url.origin), 302);
}
