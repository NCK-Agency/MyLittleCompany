import { ok } from "@/server/api-response";
import { ownerActor } from "@/server/actors";
import { memoryService } from "@/server/container";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  return ok(await memoryService.listCandidates(ownerActor()));
}
