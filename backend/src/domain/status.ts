import { TOTAL_STEPS, normaliseCompletedSteps } from "./steps.js";

export type ReleaseStatus = "planned" | "ongoing" | "done";

// The only place status is decided. It's derived on every read, never stored.
export function getReleaseStatus(completedSteps: unknown): ReleaseStatus {
  const count = normaliseCompletedSteps(completedSteps).length;
  if (count === 0) return "planned";
  if (count >= TOTAL_STEPS) return "done";
  return "ongoing";
}
