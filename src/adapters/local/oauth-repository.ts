import type { OAuthRepository } from "@/ports/oauth-repository";
import type { OAuthAuthorizationCode, OAuthClient, OAuthRefreshGrant } from "@/oauth/types";

interface LocalOAuthState {
  clients: Map<string, OAuthClient>;
  codes: Map<string, OAuthAuthorizationCode>;
  refreshGrants: Map<string, OAuthRefreshGrant>;
}

const state: LocalOAuthState = {
  clients: new Map(),
  codes: new Map(),
  refreshGrants: new Map(),
};

export class LocalOAuthRepository implements OAuthRepository {
  async createClient(client: OAuthClient): Promise<void> {
    state.clients.set(client.clientId, structuredClone(client));
  }

  async getClient(clientId: string): Promise<OAuthClient | null> {
    const client = state.clients.get(clientId);
    return client ? structuredClone(client) : null;
  }

  async createAuthorizationCode(code: OAuthAuthorizationCode): Promise<void> {
    state.codes.set(code.codeHash, structuredClone(code));
  }

  async consumeAuthorizationCode(codeHash: string): Promise<OAuthAuthorizationCode | null> {
    const code = state.codes.get(codeHash);
    if (!code) return null;
    state.codes.delete(codeHash);
    return structuredClone(code);
  }

  async createRefreshGrant(grant: OAuthRefreshGrant): Promise<void> {
    state.refreshGrants.set(grant.tokenHash, structuredClone(grant));
  }

  async consumeRefreshGrant(tokenHash: string): Promise<OAuthRefreshGrant | null> {
    const grant = state.refreshGrants.get(tokenHash);
    if (!grant) return null;
    state.refreshGrants.delete(tokenHash);
    return structuredClone(grant);
  }

  async revokeRefreshGrant(tokenHash: string): Promise<void> {
    state.refreshGrants.delete(tokenHash);
  }

  async revokeRefreshFamily(familyId: string): Promise<void> {
    for (const [tokenHash, grant] of state.refreshGrants) {
      if (grant.familyId === familyId) state.refreshGrants.delete(tokenHash);
    }
  }
}
