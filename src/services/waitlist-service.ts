import { joinWaitlistSchema } from "@/domain/schemas";
import type { WaitlistRepository } from "@/ports/waitlist-repository";

export interface JoinWaitlistResult {
  status: "JOINED";
  message: string;
}

export class WaitlistService {
  constructor(private readonly repository: WaitlistRepository) {}

  async join(input: unknown): Promise<JoinWaitlistResult> {
    const parsed = joinWaitlistSchema.parse(input);
    if (!parsed.website) {
      const now = new Date().toISOString();
      await this.repository.upsertByEmail({
        id: crypto.randomUUID(),
        email: parsed.email,
        displayName: parsed.displayName,
        companyName: parsed.companyName,
        status: "WAITING",
        source: "PUBLIC_SITE",
        createdAt: now,
        updatedAt: now,
      });
    }
    return {
      status: "JOINED",
      message: "You’re on the waitlist. We’ll email you when new accounts open.",
    };
  }
}
