import type { ReleaseStatus } from "../types";

const LABEL: Record<ReleaseStatus, string> = { planned: "Planned", ongoing: "Ongoing", done: "Done" };

export function StatusBadge({ status }: { status: ReleaseStatus }) {
  return <span className={`badge badge--${status}`}>{LABEL[status]}</span>;
}
