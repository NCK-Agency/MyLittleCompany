import { apiError, ok } from "@/server/api-response";
import { requireActor } from "@/server/auth-context";
import { memoryService } from "@/server/container";
import { z } from "zod";

interface Context { params: Promise<{ candidateId: string }> }
const approvalSchema = z.object({ expectedCandidateVersion: z.number().int().positive() });

export async function POST(request: Request, context: Context): Promise<Response> {
  try {
    const { candidateId } = await context.params;
    const input = approvalSchema.parse(await request.json());
    return ok(await memoryService.approveCandidate(candidateId, input.expectedCandidateVersion, await requireActor()));
  } catch (error) {
    return apiError(error);
  }
}
