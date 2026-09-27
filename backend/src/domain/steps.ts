// Same steps for every release, so they live in code rather than a table.
// Step IDs are stored in Release.completedSteps: don't rename an ID once it's in use.
export interface StepDefinition {
  id: string;
  order: number;
  name: string;
  description: string;
}

export const RELEASE_STEPS: readonly StepDefinition[] = Object.freeze([
  { id: "code-freeze", order: 1, name: "Code freeze", description: "Stop merging features into the release branch." },
  { id: "automated-tests", order: 2, name: "Run automated tests", description: "Unit, integration and e2e suites pass on the release branch." },
  { id: "pr-review", order: 3, name: "Review pull requests", description: "Every PR in the release has an approved review." },
  { id: "changelog", order: 4, name: "Update changelog", description: "User-facing changes are written up for this version." },
  { id: "production-build", order: 5, name: "Run production build", description: "The production artifact builds cleanly." },
  { id: "env-vars", order: 6, name: "Verify environment variables", description: "New or changed config exists in the production environment." },
  { id: "deploy", order: 7, name: "Deploy to production", description: "Ship the build to production." },
  { id: "verify-production", order: 8, name: "Verify production", description: "Smoke-test key flows and watch error rates after deploy." },
]);

export const TOTAL_STEPS = RELEASE_STEPS.length;
const STEP_IDS = new Set(RELEASE_STEPS.map((s) => s.id));

export function isValidStepId(id: string): boolean {
  return STEP_IDS.has(id);
}

// Drops unknown/duplicate IDs from the stored JSON and returns them in checklist order.
export function normaliseCompletedSteps(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const done = new Set(value.filter((v): v is string => typeof v === "string" && STEP_IDS.has(v)));
  return RELEASE_STEPS.filter((s) => done.has(s.id)).map((s) => s.id);
}
