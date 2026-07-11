import type { IdentityProvider } from "@/domain/types";

export type McpConsentScope = "knowledge:read" | "knowledge:suggest";

export interface OAuthClient {
  clientId: string;
  clientName: string;
  redirectUris: string[];
  createdAt: string;
}

export interface OAuthAuthorizationCode {
  codeHash: string;
  clientId: string;
  identityProvider: IdentityProvider;
  identitySubject: string;
  redirectUri: string;
  resource: string;
  scopes: McpConsentScope[];
  codeChallenge: string;
  expiresAt: string;
  createdAt: string;
}

export interface OAuthRefreshGrant {
  tokenHash: string;
  familyId: string;
  clientId: string;
  identityProvider: IdentityProvider;
  identitySubject: string;
  resource: string;
  scopes: McpConsentScope[];
  expiresAt: string;
  createdAt: string;
}

export interface OAuthAccessIdentity {
  clientId: string;
  identityProvider: IdentityProvider;
  identitySubject: string;
  resource: string;
  scopes: McpConsentScope[];
  expiresAt: number;
}
