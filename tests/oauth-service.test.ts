// @vitest-environment node
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { LocalOAuthRepository } from "@/adapters/local/oauth-repository";
import { OAuthProtocolError, OAuthService } from "@/oauth/oauth-service";

function service(): OAuthService {
  return new OAuthService(new LocalOAuthRepository(), {
    issuer: "http://localhost:3000",
    resource: "http://localhost:3000/mcp",
    signingKeyId: "test-key",
    consentSecret: "test-consent-secret-with-at-least-32-characters",
    identityProvider: "DEMO",
  });
}

async function registered(serviceUnderTest: OAuthService): Promise<string> {
  const registration = await serviceUnderTest.register({
    client_name: "Codex",
    redirect_uris: ["http://127.0.0.1:43123/callback"],
    token_endpoint_auth_method: "none",
  });
  return String(registration.client_id);
}

function authorizationParams(clientId: string, challenge: string): URLSearchParams {
  return new URLSearchParams({
    client_id: clientId,
    redirect_uri: "http://127.0.0.1:43123/callback",
    response_type: "code",
    resource: "http://localhost:3000/mcp",
    scope: "knowledge:read knowledge:suggest",
    state: "client-state",
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
}

describe("MCP OAuth service", () => {
  it("registers hosted and native MCP clients but rejects insecure remote redirects", async () => {
    const oauth = service();
    await expect(oauth.register({
      client_name: "Compatible hosted agent",
      redirect_uris: ["https://agent.example/oauth/callback"],
    })).resolves.toMatchObject({
      token_endpoint_auth_method: "none",
    });
    await expect(oauth.register({
      client_name: "Native agent",
      redirect_uris: ["http://localhost:43123/callback", "http://[::1]:43123/callback"],
    })).resolves.toMatchObject({ token_endpoint_auth_method: "none" });
    await expect(oauth.register({ client_name: "Insecure remote agent", redirect_uris: ["http://agent.example/callback"] }))
      .rejects.toBeInstanceOf(OAuthProtocolError);
    await expect(oauth.register({ client_name: "Credential-bearing callback", redirect_uris: ["https://user:password@agent.example/callback"] }))
      .rejects.toBeInstanceOf(OAuthProtocolError);
  });

  it("binds a one-time authorization code to PKCE, client, redirect, and resource", async () => {
    const oauth = service();
    const clientId = await registered(oauth);
    const verifier = "a-valid-pkce-verifier-with-more-than-forty-three-characters-123";
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    const request = await oauth.validateAuthorizationRequest(authorizationParams(clientId, challenge));
    expect(request.clientName).toBe("Codex");
    expect(oauth.parseConsentToken(oauth.createConsentToken(request)).clientName).toBe("Codex");
    const callback = new URL(await oauth.authorize(request, { provider: "DEMO", subject: "user-minh" }));
    const code = callback.searchParams.get("code");
    expect(code).toBeTruthy();
    const token = await oauth.exchangeAuthorizationCode({
      code: code!, clientId, redirectUri: request.redirectUri, codeVerifier: verifier, resource: request.resource,
    });
    expect(token.expires_in).toBe(900);
    expect((await oauth.verifyAccessToken(token.access_token)).identitySubject).toBe("user-minh");
    await expect(oauth.exchangeAuthorizationCode({
      code: code!, clientId, redirectUri: request.redirectUri, codeVerifier: verifier, resource: request.resource,
    })).rejects.toMatchObject({ code: "invalid_grant" });
  });

  it("rotates refresh tokens and does not allow consent expansion", async () => {
    const oauth = service();
    const clientId = await registered(oauth);
    const verifier = "another-valid-pkce-verifier-with-more-than-forty-three-characters";
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    const request = await oauth.validateAuthorizationRequest(authorizationParams(clientId, challenge));
    const callback = new URL(await oauth.authorize(request, { provider: "DEMO", subject: "user-minh" }));
    const first = await oauth.exchangeAuthorizationCode({
      code: callback.searchParams.get("code")!, clientId, redirectUri: request.redirectUri, codeVerifier: verifier, resource: request.resource,
    });
    const rotated = await oauth.refresh({
      refreshToken: first.refresh_token, clientId, resource: request.resource, scope: "knowledge:read",
    });
    expect(rotated.refresh_token).not.toBe(first.refresh_token);
    await expect(oauth.refresh({ refreshToken: first.refresh_token, clientId, resource: request.resource }))
      .rejects.toMatchObject({ code: "invalid_grant" });
  });

  it("rejects a mismatched MCP resource audience", async () => {
    const oauth = service();
    const clientId = await registered(oauth);
    const params = authorizationParams(clientId, "challenge");
    params.set("resource", "https://other.example/mcp");
    await expect(oauth.validateAuthorizationRequest(params)).rejects.toMatchObject({ code: "invalid_request" });
  });
});
