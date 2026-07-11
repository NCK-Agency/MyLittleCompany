import { getDemoState, saveDemoState } from "@/adapters/local/demo-state";
import { apiError, ok } from "@/server/api-response";
import { ownerActor } from "@/server/actors";
import { z } from "zod";

export const dynamic = "force-dynamic";

const updateCompanySchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().min(10).max(1000),
});

export async function GET(): Promise<Response> {
  return ok(getDemoState().company);
}

export async function PATCH(request: Request): Promise<Response> {
  try {
    const actor = ownerActor();
    const values = updateCompanySchema.parse(await request.json());
    const state = getDemoState();
    if (state.company.id !== actor.companyId) throw new Error("NOT_FOUND");
    state.company = { ...state.company, ...values, updatedAt: new Date().toISOString() };
    saveDemoState(state);
    return ok(state.company);
  } catch (error) {
    return apiError(error);
  }
}
