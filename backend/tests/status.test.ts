import { describe, expect, it } from "vitest";
import { getReleaseStatus } from "../src/domain/status.js";
import { RELEASE_STEPS, normaliseCompletedSteps } from "../src/domain/steps.js";

const ids = RELEASE_STEPS.map((s) => s.id);

describe("getReleaseStatus", () => {
  it("0 completed -> planned", () => {
    expect(getReleaseStatus([])).toBe("planned");
  });

  it("some completed -> ongoing", () => {
    expect(getReleaseStatus([ids[0]])).toBe("ongoing");
    expect(getReleaseStatus(ids.slice(0, -1))).toBe("ongoing");
  });

  it("all completed -> done", () => {
    expect(getReleaseStatus(ids)).toBe("done");
  });

  it("ignores unknown IDs, duplicates and malformed JSON", () => {
    expect(getReleaseStatus(["bogus", 42, null])).toBe("planned");
    expect(getReleaseStatus([ids[0], ids[0]])).toBe("ongoing");
    expect(getReleaseStatus({ not: "an array" })).toBe("planned");
    expect(getReleaseStatus([...ids, "bogus"])).toBe("done");
  });
});

describe("normaliseCompletedSteps", () => {
  it("returns known IDs in checklist order", () => {
    expect(normaliseCompletedSteps([ids[3], "x", ids[0]])).toEqual([ids[0], ids[3]]);
  });
});
