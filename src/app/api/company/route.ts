import { apiError, ok } from "@/server/api-response";
import { requireActor } from "@/server/auth-context";
import { companyService } from "@/server/container";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    return ok(await companyService.get(await requireActor()));
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request): Promise<Response> {
  try {
    return ok(await companyService.update(await request.json(), await requireActor()));
  } catch (error) {
    return apiError(error);
  }
}
