import type { OAuthAuthorizationCode, OAuthClient, OAuthRefreshGrant } from "@/oauth/types";

export interface OAuthRepository {
  createClient(client: OAuthClient): Promise<void>;
  getClient(clientId: string): Promise<OAuthClient | null>;
  createAuthorizationCode(code: OAuthAuthorizationCode): Promise<void>;
  consumeAuthorizationCode(codeHash: string): Promise<OAuthAuthorizationCode | null>;
  createRefreshGrant(grant: OAuthRefreshGrant): Promise<void>;
  consumeRefreshGrant(tokenHash: string): Promise<OAuthRefreshGrant | null>;
  revokeRefreshGrant(tokenHash: string): Promise<void>;
  revokeRefreshFamily(familyId: string): Promise<void>;
}
