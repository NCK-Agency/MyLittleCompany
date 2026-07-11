import { redirect } from "next/navigation";
import { isOwner } from "@/domain/authorization";
import { OnboardingProve } from "@/components/onboarding/onboarding-prove";
import { requireActor } from "@/server/auth-context";

export default async function OnboardingProvePage({ params }: { params: Promise<{ sessionId: string }> }) {
  if (!isOwner(await requireActor())) redirect("/no-access");
  return <OnboardingProve sessionId={(await params).sessionId} />;
}
