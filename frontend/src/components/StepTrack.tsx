import type { StepDef } from "../types";

/** One segment per checklist step, so you can see which steps are done, not just how many. */
export function StepTrack({
  steps,
  completed,
  size = "sm",
}: {
  steps: StepDef[];
  completed: string[];
  size?: "sm" | "lg";
}) {
  const done = new Set(completed);
  return (
    <div
      className={`track track--${size}`}
      role="img"
      aria-label={`${done.size} of ${steps.length} steps completed`}
    >
      {steps.map((s) => (
        <span key={s.id} className={done.has(s.id) ? "track__seg is-done" : "track__seg"} title={s.name} />
      ))}
    </div>
  );
}
