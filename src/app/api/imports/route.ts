import { apiError, ok } from "@/server/api-response";
import { requireActor } from "@/server/auth-context";
import { onboardingService } from "@/server/container";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  try {
    return ok(await onboardingService.createImport(await request.json(), await requireActor()), 201);
  } catch (error) {
    return apiError(error);
  }
}
