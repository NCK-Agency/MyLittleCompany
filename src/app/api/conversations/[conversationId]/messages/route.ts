import { apiError, ok } from "@/server/api-response";
import { ownerActor } from "@/server/actors";
import { conversationService } from "@/server/container";

interface Context {
  params: Promise<{ conversationId: string }>;
}

export async function GET(_request: Request, context: Context): Promise<Response> {
  try {
    const { conversationId } = await context.params;
    return ok(await conversationService.listMessages(conversationId, ownerActor()));
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request, context: Context): Promise<Response> {
  try {
    const { conversationId } = await context.params;
    return ok(await conversationService.send(conversationId, await request.json(), ownerActor()));
  } catch (error) {
    return apiError(error);
  }
}
