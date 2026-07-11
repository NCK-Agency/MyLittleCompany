import { redirect } from "next/navigation";
import { isOwner } from "@/domain/authorization";
import { OnboardingGoal } from "@/components/onboarding/onboarding-goal";
import { requireActor } from "@/server/auth-context";

export default async function OnboardingGoalPage() {
  if (!isOwner(await requireActor())) redirect("/no-access");
  return <OnboardingGoal />;
}
