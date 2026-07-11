import type { IdentityAdmin, InviteIdentityInput, InvitedIdentity } from "@/ports/identity-admin";

export class LocalIdentityAdmin implements IdentityAdmin {
  async invite(input: InviteIdentityInput): Promise<InvitedIdentity> {
    const normalized = input.email.trim().toLowerCase();
    return {
      provider: "DEMO",
      subject: `demo-${crypto.randomUUID()}`,
      email: normalized,
    };
  }
}
