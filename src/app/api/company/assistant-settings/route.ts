import type { AssistantSettings } from "@/domain/types";
import { apiError, ok } from "@/server/api-response";
import { requireActor } from "@/server/auth-context";
import { companyService } from "@/server/container";
import { assistantModelOptions } from "@/server/model-catalog";

export const dynamic = "force-dynamic";

function view(modelTier: AssistantSettings["modelTier"]): AssistantSettings {
  return { modelTier, options: assistantModelOptions };
}

export async function GET(): Promise<Response> {
  try {
    const actor = await requireActor();
    return ok(view(await companyService.getAssistantModelTier(actor)));
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request): Promise<Response> {
  try {
    const actor = await requireActor();
    const modelTier = await companyService.updateAssistantModelTier(await request.json(), actor);
    return ok(view(modelTier));
  } catch (error) {
    return apiError(error);
  }
}
