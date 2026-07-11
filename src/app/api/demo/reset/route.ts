import { resetDemoState } from "@/adapters/local/demo-state";
import { ok } from "@/server/api-response";

export async function POST(): Promise<Response> {
  const state = resetDemoState();
  return ok({ companyId: state.company.id, resetAt: new Date().toISOString() });
}
