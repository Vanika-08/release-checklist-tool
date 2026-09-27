import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildYoga } from "../src/app.js";
import { prisma } from "../src/db.js";

const yoga = buildYoga();
async function gql(query: string, variables?: Record<string, unknown>) {
  const res = await yoga.fetch("http://test/graphql", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  return (await res.json()) as { data?: any; errors?: { message: string; extensions?: { code?: string } }[] };
}

beforeAll(async () => {
  await prisma.release.deleteMany();
  await prisma.release.createMany({
    data: Array.from({ length: 60 }, (_, i) => ({
      name: `v${i}`,
      date: new Date(Date.UTC(2026, 0, 1 + i)),
      additionalInfo: `notes ${i}`,
    })),
  });
});
afterAll(async () => {
  await prisma.release.deleteMany();
  await prisma.$disconnect();
});

describe("releases pagination", () => {
  it("defaults to 50, newest first, and reports the total", async () => {
    const res = await gql(`{ releases { name } releaseCount }`);
    expect(res.data.releases).toHaveLength(50);
    expect(res.data.releases[0].name).toBe("v59");
    expect(res.data.releaseCount).toBe(60);
  });

  it("pages with limit/offset without overlap", async () => {
    const a = await gql(`{ releases(limit: 40) { id } }`);
    const b = await gql(`{ releases(limit: 40, offset: 40) { id } }`);
    const ids = [...a.data.releases, ...b.data.releases].map((r: any) => r.id);
    expect(ids).toHaveLength(60);
    expect(new Set(ids).size).toBe(60);
  });

  it("rejects out-of-range limit and offset", async () => {
    expect((await gql(`{ releases(limit: 500) { id } }`)).errors?.[0].extensions?.code).toBe("BAD_USER_INPUT");
    expect((await gql(`{ releases(offset: -1) { id } }`)).errors?.[0].extensions?.code).toBe("BAD_USER_INPUT");
  });

  it("still returns additionalInfo when requested, including via fragments", async () => {
    const res = await gql(`{ releases(limit: 1) { ...F } } fragment F on Release { additionalInfo }`);
    expect(res.data.releases[0].additionalInfo).toBe("notes 59");
  });
});
