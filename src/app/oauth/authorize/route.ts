import { auth } from "@/auth";
import { loginPathForMode } from "@/lib/auth-navigation";
import { env } from "@/lib/env";
import { oauthErrorResponse } from "@/oauth/http";
import { oauthService } from "@/server/container";

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character] ?? character);
}

export async function GET(request: Request): Promise<Response> {
  if (env.MCP_ENABLED !== "true") return new Response("Not found", { status: 404 });
  try {
    const url = new URL(request.url);
    const authorizationRequest = await oauthService.validateAuthorizationRequest(url.searchParams);
    const session = await auth();
    if (!session?.user.identityProvider || !session.user.identitySubject) {
      const returnTo = `${url.pathname}${url.search}`;
      const loginPath = loginPathForMode(env.AUTH_MODE);
      return Response.redirect(new URL(`${loginPath}?returnTo=${encodeURIComponent(returnTo)}`, url.origin), 302);
    }
    const consentToken = oauthService.createConsentToken(authorizationRequest);
    const callback = new URL(authorizationRequest.redirectUri);
    const returnLabel = callback.protocol === "https:" ? callback.origin : "this device";
    const scopeList = authorizationRequest.scopes.map((scope) =>
      `<li>${scope === "knowledge:read" ? "Read approved company knowledge you can already access" : "Create suggestions for company knowledge you are allowed to suggest"}</li>`,
    ).join("");
    const body = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Connect My Little Company</title><style>body{font-family:system-ui,sans-serif;background:#f7f5ef;color:#17204a;margin:0}.card{max-width:560px;margin:10vh auto;background:white;border:2px solid #17204a;padding:32px}h1{font-size:28px}li{margin:12px 0;line-height:1.5}.client{padding:12px;background:#f3f5ff}.actions{display:flex;gap:12px;margin-top:28px}button,a{font:inherit;font-weight:700;padding:12px 18px;border:2px solid #17204a;text-decoration:none}button{background:#234bd2;color:white;cursor:pointer}a{color:#17204a;background:white}</style></head><body><main class="card"><p>My Little Company</p><h1>Connect your assistant?</h1><p class="client">Client: <strong>${escapeHtml(authorizationRequest.clientName)}</strong><br>Returns to: ${escapeHtml(returnLabel)}</p><p>This assistant is asking for permission to:</p><ul>${scopeList}</ul><p>Company permissions still apply. This connection cannot approve knowledge.</p><form method="post"><input type="hidden" name="consent_token" value="${escapeHtml(consentToken)}"><div class="actions"><button type="submit" name="decision" value="allow">Allow connection</button><button type="submit" name="decision" value="deny">Cancel</button></div></form></main></body></html>`;
    return new Response(body, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
  } catch (error) {
    return oauthErrorResponse(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  if (env.MCP_ENABLED !== "true") return new Response("Not found", { status: 404 });
  try {
    const form = await request.formData();
    const consentToken = form.get("consent_token");
    if (typeof consentToken !== "string") throw new Error("Missing consent request");
    const authorizationRequest = oauthService.parseConsentToken(consentToken);
    const session = await auth();
    if (!session?.user.identityProvider || !session.user.identitySubject) {
      return new Response("Your sign-in expired. Start the connection again.", { status: 401 });
    }
    if (form.get("decision") !== "allow") {
      const callback = new URL(authorizationRequest.redirectUri);
      callback.searchParams.set("error", "access_denied");
      if (authorizationRequest.state) callback.searchParams.set("state", authorizationRequest.state);
      return Response.redirect(callback, 302);
    }
    const callback = await oauthService.authorize(authorizationRequest, {
      provider: session.user.identityProvider,
      subject: session.user.identitySubject,
    });
    return Response.redirect(callback, 302);
  } catch (error) {
    return oauthErrorResponse(error);
  }
}
