import { apiError, ok } from "@/server/api-response";
import { requireActor } from "@/server/auth-context";
import { onboardingService } from "@/server/container";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ sessionId: string }> },
): Promise<Response> {
  try {
    return ok(await onboardingService.prove(
      (await context.params).sessionId,
      await request.json(),
      await requireActor(),
    ));
  } catch (error) {
    return apiError(error);
  }
}
