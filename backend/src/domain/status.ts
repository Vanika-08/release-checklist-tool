import { TOTAL_STEPS, normaliseCompletedSteps } from "./steps.js";

export type ReleaseStatus = "planned" | "ongoing" | "done";

/**
 * The single source of truth for release status.
 *   0 completed          -> planned
 *   1..N-1 completed     -> ongoing
 *   all N completed      -> done
 * Status is never stored; it is computed from completedSteps whenever a
 * Release is returned by the API, so it can't drift out of sync.
 */
export function getReleaseStatus(completedSteps: unknown): ReleaseStatus {
  const count = normaliseCompletedSteps(completedSteps).length;
  if (count === 0) return "planned";
  if (count >= TOTAL_STEPS) return "done";
  return "ongoing";
}
