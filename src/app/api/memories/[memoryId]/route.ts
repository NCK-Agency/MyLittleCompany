import { apiError, ok } from "@/server/api-response";
import { requireActor } from "@/server/auth-context";
import { memoryService } from "@/server/container";

export const dynamic = "force-dynamic";

interface Context { params: Promise<{ memoryId: string }> }

export async function GET(_request: Request, context: Context): Promise<Response> {
  try {
    const { memoryId } = await context.params;
    const memory = await memoryService.getMemory(memoryId, await requireActor());
    if (!memory) throw new Error("NOT_FOUND");
    return ok(memory);
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request, context: Context): Promise<Response> {
  try {
    const { memoryId } = await context.params;
    return ok(await memoryService.amendMemory(memoryId, await request.json(), await requireActor()));
  } catch (error) {
    return apiError(error);
  }
}
