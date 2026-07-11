import { apiError, ok } from "@/server/api-response";
import { requireActor } from "@/server/auth-context";
import { memoryService } from "@/server/container";

interface Context { params: Promise<{ candidateId: string }> }

export async function POST(request: Request, context: Context): Promise<Response> {
  try {
    const { candidateId } = await context.params;
    return ok(await memoryService.resolveCandidate(candidateId, await request.json(), await requireActor()));
  } catch (error) {
    return apiError(error);
  }
}
