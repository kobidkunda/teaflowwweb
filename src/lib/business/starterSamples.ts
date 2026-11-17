import { TrialService } from "@/lib/trials/service";
import type { TrialPublicDto } from "@/lib/trials/types";

export function getStarterSamples(): { trials: TrialPublicDto[]; error: boolean } {
  try {
    return { trials: TrialService.listPublic({ limit: 3, offset: 0, sort_by: "published_at", sort_dir: "desc" }).trials, error: false };
  } catch {
    return { trials: [], error: true };
  }
}
