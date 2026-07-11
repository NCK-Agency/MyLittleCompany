import { apiError, ok } from "@/server/api-response";
import { ownerActor } from "@/server/actors";
import { memoryService } from "@/server/container";

export const dynamic = "force-dynamic";

interface Context { params: Promise<{ memoryId: string }> }

export async function GET(_request: Request, context: Context): Promise<Response> {
  try {
    const { memoryId } = await context.params;
    const memory = await memoryService.getMemory(memoryId, ownerActor());
    if (!memory) throw new Error("NOT_FOUND");
    return ok(memory);
  } catch (error) {
    return apiError(error);
  }
}
