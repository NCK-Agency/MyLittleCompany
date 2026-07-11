import { apiError, ok } from "@/server/api-response";
import { ownerActor } from "@/server/actors";
import { conversationService } from "@/server/container";

export async function POST(request: Request): Promise<Response> {
  try {
    return ok(await conversationService.create(await request.json(), ownerActor()), 201);
  } catch (error) {
    return apiError(error);
  }
}
