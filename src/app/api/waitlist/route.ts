import { apiError, ok } from "@/server/api-response";
import { waitlistService } from "@/server/container";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  try {
    return ok(await waitlistService.join(await request.json()), 201);
  } catch (error) {
    return apiError(error);
  }
}
