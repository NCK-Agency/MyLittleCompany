import { apiError, ok } from "@/server/api-response";
import { requireActor } from "@/server/auth-context";
import { conversationService } from "@/server/container";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    return ok(await conversationService.list(await requireActor()));
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    return ok(await conversationService.create(await request.json(), await requireActor()), 201);
  } catch (error) {
    return apiError(error);
  }
}
