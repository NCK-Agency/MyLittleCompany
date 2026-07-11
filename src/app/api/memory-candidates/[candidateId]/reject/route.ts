import { apiError, ok } from "@/server/api-response";
import { requireActor } from "@/server/auth-context";
import { memoryService, onboardingService } from "@/server/container";

interface Context { params: Promise<{ candidateId: string }> }

export async function POST(_request: Request, context: Context): Promise<Response> {
  try {
    const { candidateId } = await context.params;
    const actor = await requireActor();
    const candidate = await memoryService.rejectCandidate(candidateId, actor);
    await onboardingService.candidateRejected(candidate, actor);
    return ok(candidate);
  } catch (error) {
    return apiError(error);
  }
}
