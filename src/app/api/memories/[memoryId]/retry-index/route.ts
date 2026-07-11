import { apiError, ok } from "@/server/api-response";
import { requireActor } from "@/server/auth-context";
import { memoryService } from "@/server/container";

interface Context { params: Promise<{ memoryId: string }> }

export async function POST(_request: Request, context: Context): Promise<Response> {
  try {
    const { memoryId } = await context.params;
    return ok(await memoryService.retryIndex(memoryId, await requireActor()));
  } catch (error) {
    return apiError(error);
  }
}
