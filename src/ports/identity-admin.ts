import type { IdentityProvider } from "@/domain/types";

export interface InviteIdentityInput {
  email: string;
  displayName: string;
}

export interface InvitedIdentity {
  provider: IdentityProvider;
  subject: string;
  email: string;
}

export interface IdentityAdmin {
  invite(input: InviteIdentityInput): Promise<InvitedIdentity>;
}
