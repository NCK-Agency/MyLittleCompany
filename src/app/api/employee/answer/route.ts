import { apiError, ok } from "@/server/api-response";
import { requireActor } from "@/server/auth-context";
import { assistantService } from "@/server/container";
import { z } from "zod";

const requestSchema = z.object({
  question: z.string().trim().min(1).max(1000),
  scope: z.object({
    level: z.enum(["COMPANY", "DEPARTMENT"]),
    organizationalUnitId: z.string().min(1).optional(),
  }).default({ level: "COMPANY" }),
});

export async function POST(request: Request): Promise<Response> {
  try {
    const input = requestSchema.parse(await request.json());
    return ok(await assistantService.answerEmployee(input.question, await requireActor(), input.scope));
  } catch (error) {
    return apiError(error);
  }
}
