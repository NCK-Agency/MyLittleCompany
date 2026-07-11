import { apiError, ok } from "@/server/api-response";
import { ownerActor } from "@/server/actors";
import { memoryService } from "@/server/container";

interface Context { params: Promise<{ candidateId: string }> }

export async function POST(_request: Request, context: Context): Promise<Response> {
  try {
    const { candidateId } = await context.params;
    return ok(await memoryService.rejectCandidate(candidateId, ownerActor()));
  } catch (error) {
    return apiError(error);
  }
}
