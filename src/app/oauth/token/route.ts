import { env } from "@/lib/env";
import { OAuthProtocolError } from "@/oauth/oauth-service";
import { oauthErrorResponse, noStoreJson } from "@/oauth/http";
import { oauthService } from "@/server/container";

function required(form: FormData, name: string): string {
  const value = form.get(name);
  if (typeof value !== "string" || !value) throw new OAuthProtocolError("invalid_request", `${name} is required.`);
  return value;
}

export async function POST(request: Request): Promise<Response> {
  if (env.MCP_ENABLED !== "true") return new Response("Not found", { status: 404 });
  try {
    const form = await request.formData();
    const grantType = required(form, "grant_type");
    if (grantType === "authorization_code") {
      return noStoreJson(await oauthService.exchangeAuthorizationCode({
        code: required(form, "code"),
        clientId: required(form, "client_id"),
        redirectUri: required(form, "redirect_uri"),
        codeVerifier: required(form, "code_verifier"),
        resource: required(form, "resource"),
      }));
    }
    if (grantType === "refresh_token") {
      const scope = form.get("scope");
      return noStoreJson(await oauthService.refresh({
        refreshToken: required(form, "refresh_token"),
        clientId: required(form, "client_id"),
        resource: required(form, "resource"),
        scope: typeof scope === "string" && scope ? scope : undefined,
      }));
    }
    throw new OAuthProtocolError("unsupported_grant_type", "Unsupported grant type.");
  } catch (error) {
    return oauthErrorResponse(error);
  }
}
