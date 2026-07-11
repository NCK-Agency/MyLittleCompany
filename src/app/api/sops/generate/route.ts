import { apiError, ok } from "@/server/api-response";
import { requireActor } from "@/server/auth-context";
import { sopService } from "@/server/container";
import { z } from "zod";

const requestSchema = z.object({
  saveAsSuggestion: z.boolean().default(false),
  request: z.string().trim().min(1).max(2_000).default("Create the Tuesday promotion SOP from our approved company rules."),
  scope: z.object({
    level: z.enum(["COMPANY", "DEPARTMENT"]),
    organizationalUnitId: z.string().min(1).optional(),
  }).default({ level: "COMPANY" }),
});

export async function POST(request: Request): Promise<Response> {
  try {
    const input = requestSchema.parse(await request.json());
    return ok(await sopService.generate(await requireActor(), input.saveAsSuggestion, input.request, input.scope));
  } catch (error) {
    return apiError(error);
  }
}
