import { apiError, ok } from "@/server/api-response";
import { requireActor } from "@/server/auth-context";
import { companyService } from "@/server/container";

export async function POST(): Promise<Response> {
  try {
    const company = await companyService.resetDemo(await requireActor());
    return ok({ companyId: company.id, resetAt: new Date().toISOString() });
  } catch (error) {
    return apiError(error);
  }
}
