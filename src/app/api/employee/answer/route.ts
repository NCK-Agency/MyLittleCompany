import { apiError, ok } from "@/server/api-response";
import { employeeActor } from "@/server/actors";
import { assistantService } from "@/server/container";
import { z } from "zod";

const requestSchema = z.object({ question: z.string().trim().min(1).max(1000) });

export async function POST(request: Request): Promise<Response> {
  try {
    const input = requestSchema.parse(await request.json());
    return ok(await assistantService.answerEmployee(input.question, employeeActor()));
  } catch (error) {
    return apiError(error);
  }
}
