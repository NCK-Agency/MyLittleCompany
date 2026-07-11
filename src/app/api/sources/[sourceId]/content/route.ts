import { apiError, ok } from "@/server/api-response";
import { requireActor } from "@/server/auth-context";
import { onboardingService } from "@/server/container";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ sourceId: string }> },
): Promise<Response> {
  try {
    await onboardingService.deleteSource((await context.params).sourceId, await requireActor());
    return ok({ deleted: true });
  } catch (error) {
    return apiError(error);
  }
}
