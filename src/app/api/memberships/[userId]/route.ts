import { apiError, ok } from "@/server/api-response";
import { requireActor } from "@/server/auth-context";
import { membershipService } from "@/server/container";

interface Context { params: Promise<{ userId: string }> }

export async function PATCH(request: Request, context: Context): Promise<Response> {
  try {
    const { userId } = await context.params;
    return ok(await membershipService.update(userId, await request.json(), await requireActor()));
  } catch (error) {
    return apiError(error);
  }
}
