import type { AssistantModelOption, AssistantModelTier } from "@/domain/types";
import { env } from "@/lib/env";

export const assistantModelOptions: readonly AssistantModelOption[] = Object.freeze([
  {
    tier: "FAST",
    label: "Fast",
    description: "Quick responses for everyday work.",
    modelId: env.OPENAI_MODEL_FAST,
  },
  {
    tier: "BALANCED",
    label: "Balanced",
    description: "A dependable mix of speed and quality.",
    modelId: env.OPENAI_MODEL_BALANCED,
  },
  {
    tier: "BEST",
    label: "Best quality",
    description: "More care for complex or important work.",
    modelId: env.OPENAI_MODEL_BEST,
  },
]);

export function modelIdForTier(tier: AssistantModelTier): string {
  const option = assistantModelOptions.find((candidate) => candidate.tier === tier);
  if (!option) throw new Error("CONFIGURATION_ERROR");
  return option.modelId;
}
