import { apiError, ok } from "@/server/api-response";
import { requireActor } from "@/server/auth-context";
import { onboardingService } from "@/server/container";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ batchId: string }> },
): Promise<Response> {
  try {
    return ok(await onboardingService.cancel((await context.params).batchId, await requireActor()));
  } catch (error) {
    return apiError(error);
  }
}
