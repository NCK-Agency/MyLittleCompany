import { redirect } from "next/navigation";
import { isOwner } from "@/domain/authorization";
import { OnboardingReview } from "@/components/onboarding/onboarding-review";
import { requireActor } from "@/server/auth-context";

export default async function OnboardingReviewPage({ params }: { params: Promise<{ sessionId: string }> }) {
  if (!isOwner(await requireActor())) redirect("/no-access");
  return <OnboardingReview sessionId={(await params).sessionId} />;
}
