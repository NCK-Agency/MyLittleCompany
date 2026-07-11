import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import {
  exportJWK,
  generateKeyPair,
  importJWK,
  jwtVerify,
  SignJWT,
  type JWK,
} from "jose";
import { z } from "zod";
import type { IdentityProvider } from "@/domain/types";
import type {
  McpConsentScope,
  OAuthAccessIdentity,
  OAuthAuthorizationCode,
  OAuthClient,
  OAuthRefreshGrant,
} from "@/oauth/types";
import type { OAuthRepository } from "@/ports/oauth-repository";

const supportedScopes = ["knowledge:read", "knowledge:suggest"] as const;
const registrationSchema = z.object({
  client_name: z.string().trim().min(1).max(100).default("Connected assistant"),
  redirect_uris: z.array(z.url()).min(1).max(10),
  token_endpoint_auth_method: z.literal("none").optional().default("none"),
  grant_types: z.array(z.string()).optional(),
  response_types: z.array(z.string()).optional(),
});

export interface AuthorizationRequest {
  clientId: string;
  clientName: string;
  redirectUri: string;
  responseType: "code";
  resource: string;
  scopes: McpConsentScope[];
  state?: string;
  codeChallenge: string;
  codeChallengeMethod: "S256";
}

export interface OAuthTokenResponse {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  refresh_token: string;
  scope: string;
}

export class OAuthProtocolError extends Error {
  constructor(
    readonly code: "invalid_request" | "invalid_client" | "invalid_grant" | "invalid_scope" | "unsupported_grant_type",
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

interface SigningMaterial {
  privateKey: CryptoKey;
  publicJwk: JWK;
}

interface OAuthServiceConfig {
  issuer: string;
  resource: string;
  signingKeyId: string;
  privateJwk?: string;
  consentSecret: string;
  identityProvider: IdentityProvider;
}

export class OAuthService {
  private readonly issuer: string;
  private readonly resource: string;
  private readonly signingMaterial: Promise<SigningMaterial>;

  constructor(private readonly repository: OAuthRepository, private readonly config: OAuthServiceConfig) {
    this.issuer = config.issuer.replace(/\/$/, "");
    this.resource = config.resource;
    this.signingMaterial = this.loadSigningMaterial(config.privateJwk);
  }

  get authorizationServerMetadata(): Record<string, unknown> {
    return {
      issuer: this.issuer,
      authorization_endpoint: `${this.issuer}/oauth/authorize`,
      token_endpoint: `${this.issuer}/oauth/token`,
      revocation_endpoint: `${this.issuer}/oauth/revoke`,
      registration_endpoint: `${this.issuer}/oauth/register`,
      jwks_uri: `${this.issuer}/oauth/jwks`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"],
      scopes_supported: supportedScopes,
    };
  }

  get protectedResourceMetadata(): Record<string, unknown> {
    return {
      resource: this.resource,
      authorization_servers: [this.issuer],
      scopes_supported: supportedScopes,
      bearer_methods_supported: ["header"],
    };
  }

  async register(input: unknown): Promise<Record<string, unknown>> {
    const values = registrationSchema.parse(input);
    if (values.grant_types && values.grant_types.some((value) => !["authorization_code", "refresh_token"].includes(value))) {
      throw new OAuthProtocolError("invalid_request", "Only authorization_code and refresh_token are supported.");
    }
    if (values.response_types && values.response_types.some((value) => value !== "code")) {
      throw new OAuthProtocolError("invalid_request", "Only the code response type is supported.");
    }
    for (const redirectUri of values.redirect_uris) this.assertAllowedRedirectUri(redirectUri);
    const client: OAuthClient = {
      clientId: `mcp-${randomUUID()}`,
      clientName: values.client_name,
      redirectUris: [...new Set(values.redirect_uris)],
      createdAt: new Date().toISOString(),
    };
    await this.repository.createClient(client);
    return {
      client_id: client.clientId,
      client_name: client.clientName,
      redirect_uris: client.redirectUris,
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    };
  }

  async validateAuthorizationRequest(params: URLSearchParams): Promise<AuthorizationRequest> {
    const clientId = this.required(params, "client_id");
    const redirectUri = this.required(params, "redirect_uri");
    const resource = this.required(params, "resource");
    const responseType = this.required(params, "response_type");
    const codeChallenge = this.required(params, "code_challenge");
    const codeChallengeMethod = this.required(params, "code_challenge_method");
    if (responseType !== "code") throw new OAuthProtocolError("invalid_request", "response_type must be code.");
    if (codeChallengeMethod !== "S256") throw new OAuthProtocolError("invalid_request", "PKCE S256 is required.");
    if (resource !== this.resource) throw new OAuthProtocolError("invalid_request", "The requested resource is not this MCP server.");
    const client = await this.repository.getClient(clientId);
    if (!client) throw new OAuthProtocolError("invalid_client", "Unknown OAuth client.", 401);
    if (!client.redirectUris.includes(redirectUri)) throw new OAuthProtocolError("invalid_request", "Unregistered redirect URI.");
    const scopes = this.parseScopes(this.required(params, "scope"));
    return {
      clientId,
      clientName: client.clientName,
      redirectUri,
      resource,
      responseType: "code",
      scopes,
      state: params.get("state") ?? undefined,
      codeChallenge,
      codeChallengeMethod: "S256",
    };
  }

  createConsentToken(request: AuthorizationRequest): string {
    const payload = this.serializeAuthorizationRequest(request);
    const signature = createHmac("sha256", this.config.consentSecret).update(payload).digest("base64url");
    return `${Buffer.from(payload).toString("base64url")}.${signature}`;
  }

  parseConsentToken(token: string): AuthorizationRequest {
    const [encodedPayload, signature] = token.split(".");
    if (!encodedPayload || !signature) throw new OAuthProtocolError("invalid_request", "Invalid consent request.");
    const payload = Buffer.from(encodedPayload, "base64url").toString("utf8");
    const expected = createHmac("sha256", this.config.consentSecret).update(payload).digest("base64url");
    const actualBytes = Buffer.from(signature);
    const expectedBytes = Buffer.from(expected);
    if (actualBytes.length !== expectedBytes.length || !timingSafeEqual(actualBytes, expectedBytes)) {
      throw new OAuthProtocolError("invalid_request", "Invalid consent request.");
    }
    const parsed = JSON.parse(payload) as AuthorizationRequest & { issuedAt: number };
    if (Date.now() - parsed.issuedAt > 10 * 60 * 1000) throw new OAuthProtocolError("invalid_request", "The login transaction expired.");
    return {
      clientId: parsed.clientId,
      clientName: parsed.clientName,
      redirectUri: parsed.redirectUri,
      responseType: "code",
      resource: parsed.resource,
      scopes: parsed.scopes,
      state: parsed.state,
      codeChallenge: parsed.codeChallenge,
      codeChallengeMethod: "S256",
    };
  }

  async authorize(
    request: AuthorizationRequest,
    identity: { provider: IdentityProvider; subject: string },
  ): Promise<string> {
    const client = await this.repository.getClient(request.clientId);
    if (!client || !client.redirectUris.includes(request.redirectUri) || request.resource !== this.resource) {
      throw new OAuthProtocolError("invalid_request", "The authorization request is no longer valid.");
    }
    const rawCode = randomBytes(32).toString("base64url");
    const now = new Date();
    const code: OAuthAuthorizationCode = {
      codeHash: this.hash(rawCode),
      clientId: request.clientId,
      identityProvider: identity.provider,
      identitySubject: identity.subject,
      redirectUri: request.redirectUri,
      resource: request.resource,
      scopes: request.scopes,
      codeChallenge: request.codeChallenge,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 5 * 60 * 1000).toISOString(),
    };
    await this.repository.createAuthorizationCode(code);
    const callback = new URL(request.redirectUri);
    callback.searchParams.set("code", rawCode);
    if (request.state) callback.searchParams.set("state", request.state);
    return callback.toString();
  }

  async exchangeAuthorizationCode(input: {
    code: string;
    clientId: string;
    redirectUri: string;
    codeVerifier: string;
    resource: string;
  }): Promise<OAuthTokenResponse> {
    const code = await this.repository.consumeAuthorizationCode(this.hash(input.code));
    if (!code) throw new OAuthProtocolError("invalid_grant", "Authorization code is invalid or already used.");
    if (new Date(code.expiresAt).getTime() <= Date.now()) throw new OAuthProtocolError("invalid_grant", "Authorization code expired.");
    if (code.clientId !== input.clientId || code.redirectUri !== input.redirectUri || code.resource !== input.resource) {
      throw new OAuthProtocolError("invalid_grant", "Authorization code binding did not match.");
    }
    const challenge = createHash("sha256").update(input.codeVerifier).digest("base64url");
    if (challenge !== code.codeChallenge) throw new OAuthProtocolError("invalid_grant", "PKCE verification failed.");
    return this.issueTokenPair({
      clientId: code.clientId,
      identityProvider: code.identityProvider,
      identitySubject: code.identitySubject,
      resource: code.resource,
      scopes: code.scopes,
      familyId: randomUUID(),
    });
  }

  async refresh(input: { refreshToken: string; clientId: string; resource: string; scope?: string }): Promise<OAuthTokenResponse> {
    const tokenHash = this.hash(input.refreshToken);
    const grant = await this.repository.consumeRefreshGrant(tokenHash);
    if (!grant) throw new OAuthProtocolError("invalid_grant", "Refresh token is invalid, revoked, or already used.");
    if (new Date(grant.expiresAt).getTime() <= Date.now() || grant.clientId !== input.clientId || grant.resource !== input.resource) {
      await this.repository.revokeRefreshFamily(grant.familyId);
      throw new OAuthProtocolError("invalid_grant", "Refresh token binding did not match.");
    }
    const scopes = input.scope ? this.parseScopes(input.scope) : grant.scopes;
    if (scopes.some((scope) => !grant.scopes.includes(scope))) {
      await this.repository.revokeRefreshFamily(grant.familyId);
      throw new OAuthProtocolError("invalid_scope", "A refresh cannot expand consent.");
    }
    return this.issueTokenPair({ ...grant, scopes });
  }

  async revoke(rawToken: string): Promise<void> {
    await this.repository.revokeRefreshGrant(this.hash(rawToken));
  }

  async verifyAccessToken(rawToken: string): Promise<OAuthAccessIdentity> {
    const { publicJwk } = await this.signingMaterial;
    const publicKey = await importJWK(publicJwk, "RS256");
    const verified = await jwtVerify(rawToken, publicKey, {
      issuer: this.issuer,
      audience: this.resource,
      algorithms: ["RS256"],
    });
    const scopes = this.parseScopes(String(verified.payload.scope ?? ""));
    const clientId = String(verified.payload.client_id ?? "");
    const subject = verified.payload.sub;
    if (!clientId || !subject || !verified.payload.exp) throw new OAuthProtocolError("invalid_grant", "Access token claims are incomplete.", 401);
    return {
      clientId,
      identityProvider: this.config.identityProvider,
      identitySubject: subject,
      resource: this.resource,
      scopes,
      expiresAt: verified.payload.exp,
    };
  }

  async jwks(): Promise<{ keys: JWK[] }> {
    const { publicJwk } = await this.signingMaterial;
    return { keys: [publicJwk] };
  }

  private async issueTokenPair(input: {
    clientId: string;
    identityProvider: IdentityProvider;
    identitySubject: string;
    resource: string;
    scopes: McpConsentScope[];
    familyId: string;
  }): Promise<OAuthTokenResponse> {
    const { privateKey } = await this.signingMaterial;
    const accessToken = await new SignJWT({ scope: input.scopes.join(" "), client_id: input.clientId })
      .setProtectedHeader({ alg: "RS256", kid: this.config.signingKeyId, typ: "at+jwt" })
      .setIssuer(this.issuer)
      .setSubject(input.identitySubject)
      .setAudience(input.resource)
      .setIssuedAt()
      .setJti(randomUUID())
      .setExpirationTime("15m")
      .sign(privateKey);
    const refreshToken = randomBytes(48).toString("base64url");
    const now = new Date();
    const grant: OAuthRefreshGrant = {
      tokenHash: this.hash(refreshToken),
      familyId: input.familyId,
      clientId: input.clientId,
      identityProvider: input.identityProvider,
      identitySubject: input.identitySubject,
      resource: input.resource,
      scopes: input.scopes,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    };
    await this.repository.createRefreshGrant(grant);
    return {
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: 15 * 60,
      refresh_token: refreshToken,
      scope: input.scopes.join(" "),
    };
  }

  private parseScopes(value: string): McpConsentScope[] {
    const scopes = [...new Set(value.split(/\s+/).filter(Boolean))];
    if (!scopes.length || scopes.some((scope) => !supportedScopes.includes(scope as McpConsentScope))) {
      throw new OAuthProtocolError("invalid_scope", "Only knowledge:read and knowledge:suggest are supported.");
    }
    return scopes as McpConsentScope[];
  }

  private assertAllowedRedirectUri(value: string): void {
    const url = new URL(value);
    const hostedClient = url.protocol === "https:";
    const nativeLoopback = url.protocol === "http:"
      && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (url.hash || url.username || url.password || (!hostedClient && !nativeLoopback)) {
      throw new OAuthProtocolError(
        "invalid_request",
        "Redirect URI must use HTTPS or an HTTP loopback address for a native MCP client.",
      );
    }
  }

  private required(params: URLSearchParams, name: string): string {
    const value = params.get(name);
    if (!value) throw new OAuthProtocolError("invalid_request", `${name} is required.`);
    return value;
  }

  private serializeAuthorizationRequest(request: AuthorizationRequest): string {
    return JSON.stringify({ ...request, issuedAt: Date.now() });
  }

  private hash(value: string): string {
    return createHash("sha256").update(value).digest("base64url");
  }

  private async loadSigningMaterial(privateJwkValue?: string): Promise<SigningMaterial> {
    if (privateJwkValue) {
      const privateJwk = JSON.parse(privateJwkValue) as JWK;
      const privateKey = await importJWK(privateJwk, "RS256") as CryptoKey;
      const publicJwk = { ...privateJwk };
      delete publicJwk.d;
      delete publicJwk.p;
      delete publicJwk.q;
      delete publicJwk.dp;
      delete publicJwk.dq;
      delete publicJwk.qi;
      publicJwk.use = "sig";
      publicJwk.alg = "RS256";
      publicJwk.kid = this.config.signingKeyId;
      return { privateKey, publicJwk };
    }
    const generated = await generateKeyPair("RS256", { modulusLength: 2048, extractable: true });
    const publicJwk = await exportJWK(generated.publicKey);
    publicJwk.use = "sig";
    publicJwk.alg = "RS256";
    publicJwk.kid = this.config.signingKeyId;
    return { privateKey: generated.privateKey, publicJwk };
  }
}
