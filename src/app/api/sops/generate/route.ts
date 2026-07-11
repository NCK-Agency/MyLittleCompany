import { apiError, ok } from "@/server/api-response";
import { ownerActor } from "@/server/actors";
import { sopService } from "@/server/container";
import { z } from "zod";

const requestSchema = z.object({ saveAsSuggestion: z.boolean().default(false) });

export async function POST(request: Request): Promise<Response> {
  try {
    const input = requestSchema.parse(await request.json());
    return ok(await sopService.generate(ownerActor(), input.saveAsSuggestion));
  } catch (error) {
    return apiError(error);
  }
}
