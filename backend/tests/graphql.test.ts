import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { buildYoga } from "../src/app.js";
import { prisma } from "../src/db.js";
import { RELEASE_STEPS } from "../src/domain/steps.js";

const yoga = buildYoga();

async function gql(query: string, variables?: Record<string, unknown>) {
  const res = await yoga.fetch("http://test/graphql", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  return (await res.json()) as {
    data?: any;
    errors?: { message: string; extensions?: { code?: string } }[];
  };
}

const CREATE = `mutation($input: CreateReleaseInput!) { createRelease(input: $input) { id name status completedCount totalSteps } }`;
const GET = `query($id: ID!) { release(id: $id) { id name status additionalInfo completedCount steps { id completed } } }`;
const TOGGLE = `mutation($r: ID!, $s: ID!, $c: Boolean) { toggleStep(releaseId: $r, stepId: $s, completed: $c) { status completedCount } }`;

beforeEach(async () => {
  await prisma.release.deleteMany();
});
afterAll(async () => {
  await prisma.$disconnect();
});

describe("GraphQL release flow", () => {
  it("create -> fetch -> toggle steps -> status changes -> delete", async () => {
    const created = await gql(CREATE, {
      input: { name: "Version 2.4.0", date: "2026-10-01T10:00:00.000Z" },
    });
    expect(created.errors).toBeUndefined();
    const id = created.data.createRelease.id;
    expect(created.data.createRelease).toMatchObject({
      status: "planned",
      completedCount: 0,
      totalSteps: 8,
    });

    const fetched = await gql(GET, { id });
    expect(fetched.data.release.name).toBe("Version 2.4.0");
    expect(fetched.data.release.steps.every((s: any) => !s.completed)).toBe(
      true,
    );

    const first = await gql(TOGGLE, { r: id, s: RELEASE_STEPS[0].id });
    expect(first.data.toggleStep).toEqual({
      status: "ongoing",
      completedCount: 1,
    });

    for (const step of RELEASE_STEPS.slice(1))
      await gql(TOGGLE, { r: id, s: step.id, c: true });
    const done = await gql(GET, { id });
    expect(done.data.release).toMatchObject({
      status: "done",
      completedCount: 8,
    });

    // Unchecking one step moves it back to ongoing.
    const back = await gql(TOGGLE, { r: id, s: RELEASE_STEPS[4].id });
    expect(back.data.toggleStep.status).toBe("ongoing");

    const info = await gql(
      `mutation($id: ID!) { updateAdditionalInfo(id: $id, additionalInfo: "Rollback plan: v2.3.9") { additionalInfo } }`,
      { id },
    );
    expect(info.data.updateAdditionalInfo.additionalInfo).toBe(
      "Rollback plan: v2.3.9",
    );

    const del = await gql(`mutation($id: ID!) { deleteRelease(id: $id) }`, {
      id,
    });
    expect(del.data.deleteRelease).toBe(id);
    expect((await gql(GET, { id })).data.release).toBeNull();
  });

  it("rejects duplicate release names", async () => {
    const first = await gql(CREATE, {
      input: { name: "Duplicate Release", date: "2026-10-01T10:00:00Z" },
    });

    expect(first.errors).toBeUndefined();

    const second = await gql(CREATE, {
      input: { name: "Duplicate Release", date: "2026-10-02T10:00:00Z" },
    });

    expect(second.errors).toBeDefined();
    expect(second.errors?.[0].extensions?.code).toBe("CONFLICT");
  });

  it("rejects renaming to an existing name", async () => {
    await gql(CREATE, { input: { name: "Taken", date: "2026-10-01T10:00:00Z" } });
    const id = (await gql(CREATE, { input: { name: "Other", date: "2026-10-01T10:00:00Z" } })).data.createRelease.id;
    const res = await gql(`mutation($id: ID!) { updateRelease(id: $id, input: { name: "Taken" }) { id } }`, { id });
    expect(res.errors?.[0].extensions?.code).toBe("CONFLICT");
  });

  it("setting completed: true twice is idempotent", async () => {
    const id = (
      await gql(CREATE, { input: { name: "v1", date: "2026-10-01T10:00:00Z" } })
    ).data.createRelease.id;
    await gql(TOGGLE, { r: id, s: "deploy", c: true });
    const again = await gql(TOGGLE, { r: id, s: "deploy", c: true });
    expect(again.data.toggleStep.completedCount).toBe(1);
  });

  it("concurrent toggles on one release don't lose writes", async () => {
    const id = (
      await gql(CREATE, {
        input: { name: "race", date: "2026-10-01T10:00:00Z" },
      })
    ).data.createRelease.id;
    await Promise.all(
      RELEASE_STEPS.map((s) => gql(TOGGLE, { r: id, s: s.id, c: true })),
    );
    expect((await gql(GET, { id })).data.release.status).toBe("done");
  });
});

describe("GraphQL validation", () => {
  it("rejects an empty name", async () => {
    const res = await gql(CREATE, {
      input: { name: "   ", date: "2026-10-01T10:00:00Z" },
    });
    expect(res.errors?.[0]).toMatchObject({
      message: "Name cannot be empty",
      extensions: { code: "BAD_USER_INPUT" },
    });
  });

  it("rejects an invalid date", async () => {
    const res = await gql(CREATE, {
      input: { name: "v1", date: "not-a-date" },
    });
    expect(res.errors?.[0].message).toMatch(/Invalid DateTime/);
  });

  it("rejects a missing date at the schema level", async () => {
    const res = await gql(CREATE, { input: { name: "v1" } });
    expect(res.errors?.length).toBeGreaterThan(0);
  });

  it("rejects an unknown step ID", async () => {
    const id = (
      await gql(CREATE, { input: { name: "v1", date: "2026-10-01T10:00:00Z" } })
    ).data.createRelease.id;
    const res = await gql(TOGGLE, { r: id, s: "launch-rockets" });
    expect(res.errors?.[0].extensions?.code).toBe("BAD_USER_INPUT");
  });

  it("returns NOT_FOUND for a missing release", async () => {
    const res = await gql(TOGGLE, {
      r: "00000000-0000-0000-0000-000000000000",
      s: "deploy",
    });
    expect(res.errors?.[0].extensions?.code).toBe("NOT_FOUND");
    const del = await gql(`mutation { deleteRelease(id: "not-a-uuid") }`);
    expect(del.errors?.[0].extensions?.code).toBe("NOT_FOUND");
  });
});
