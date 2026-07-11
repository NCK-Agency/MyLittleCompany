import { apiError, ok } from "@/server/api-response";
import { requireActor } from "@/server/auth-context";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    return ok(await requireActor());
  } catch (error) {
    return apiError(error);
  }
}
