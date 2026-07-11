import { apiError, ok } from "@/server/api-response";
import { requireActor } from "@/server/auth-context";
import { memoryService } from "@/server/container";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    return ok(await memoryService.listCandidates(await requireActor()));
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    return ok(await memoryService.createSuggestion(await request.json(), await requireActor()), 201);
  } catch (error) {
    return apiError(error);
  }
}
