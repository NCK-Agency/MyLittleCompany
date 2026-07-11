import { apiError, ok } from "@/server/api-response";
import { requireActor } from "@/server/auth-context";
import { conversationService } from "@/server/container";

interface Context {
  params: Promise<{ conversationId: string }>;
}

export async function GET(_request: Request, context: Context): Promise<Response> {
  try {
    const { conversationId } = await context.params;
    return ok(await conversationService.listMessages(conversationId, await requireActor()));
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request, context: Context): Promise<Response> {
  try {
    const { conversationId } = await context.params;
    return ok(await conversationService.send(conversationId, await request.json(), await requireActor()));
  } catch (error) {
    return apiError(error);
  }
}
