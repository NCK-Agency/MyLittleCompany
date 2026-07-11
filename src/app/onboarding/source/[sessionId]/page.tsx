import { redirect } from "next/navigation";
import { isOwner } from "@/domain/authorization";
import { OnboardingSource } from "@/components/onboarding/onboarding-source";
import { requireActor } from "@/server/auth-context";

export default async function OnboardingSourcePage({ params }: { params: Promise<{ sessionId: string }> }) {
  if (!isOwner(await requireActor())) redirect("/no-access");
  return <OnboardingSource sessionId={(await params).sessionId} />;
}
