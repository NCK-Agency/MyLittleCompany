import { redirect } from "next/navigation";
import { isOwner } from "@/domain/authorization";
import { onboardingPath } from "@/components/onboarding/onboarding-types";
import { requireActor } from "@/server/auth-context";
import { onboardingService } from "@/server/container";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const actor = await requireActor();
  if (!isOwner(actor)) redirect("/no-access");
  const active = await onboardingService.active(actor);
  redirect(active ? onboardingPath(active) : "/onboarding/goal");
}
