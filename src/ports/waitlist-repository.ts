import type { WaitlistEntry } from "@/domain/types";

export interface WaitlistRepository {
  upsertByEmail(entry: WaitlistEntry): Promise<WaitlistEntry>;
}
