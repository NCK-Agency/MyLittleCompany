import type { ImportBatch, MemoryCandidate, OnboardingSession } from "@/domain/types";

export interface OnboardingSessionView {
  session: OnboardingSession;
  batch: ImportBatch | null;
  candidates: MemoryCandidate[];
}

export function onboardingPath(view: OnboardingSessionView): string {
  const id = view.session.id;
  if (view.session.state === "SOURCE" || view.session.state === "GOAL") return `/onboarding/source/${id}`;
  if (view.session.state === "REVIEWING") return `/onboarding/review/${id}`;
  if (view.session.state === "PROVING" || view.session.state === "COMPLETED") return `/onboarding/prove/${id}`;
  return view.batch ? `/onboarding/source/${id}` : "/onboarding/goal";
}

export function onboardingStep(view: OnboardingSessionView): string {
  if (view.session.state === "SOURCE" || view.session.state === "GOAL") return "choose context";
  if (view.session.state === "PROCESSING") return "reading context";
  if (view.session.state === "REVIEWING") return "review suggestions";
  if (view.session.state === "PROVING") return "prove it";
  return "complete";
}
