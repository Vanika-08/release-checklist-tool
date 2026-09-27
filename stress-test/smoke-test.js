/**
 * End-to-end smoke test against a running API (local or deployed).
 *   API_URL=https://your-api.onrender.com/graphql node smoke-test.js
 * Creates a release, walks it through planned -> ongoing -> done, edits it,
 * checks validation errors, then deletes it. Exits non-zero on any failure.
 */
const API_URL = process.env.API_URL ?? "http://localhost:4000/graphql";

async function gql(query, variables) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  return res.json();
}
function check(cond, msg) {
  if (!cond) { console.error(`FAIL  ${msg}`); process.exit(1); }
  console.log(`ok    ${msg}`);
}

const steps = (await gql(`{ steps { id } }`)).data.steps.map((s) => s.id);
check(steps.length === 8, `steps query returns ${steps.length} steps`);

const c = await gql(`mutation($i: CreateReleaseInput!) { createRelease(input: $i) { id status } }`,
  { i: { name: `Smoke test ${new Date().toISOString()}`, date: new Date(Date.now() + 864e5).toISOString() } });
const id = c.data?.createRelease.id;
check(id && c.data.createRelease.status === "planned", "createRelease -> planned");

const list = await gql(`{ releases(limit: 100) { id } releaseCount }`);
check(list.data.releases.some((r) => r.id === id) || list.data.releaseCount > 100, "new release appears in releases");

const t1 = await gql(`mutation($r: ID!, $s: ID!) { toggleStep(releaseId: $r, stepId: $s) { status completedCount } }`, { r: id, s: steps[0] });
check(t1.data.toggleStep.status === "ongoing", "toggleStep first step -> ongoing");

for (const s of steps.slice(1)) await gql(`mutation($r: ID!, $s: ID!) { toggleStep(releaseId: $r, stepId: $s, completed: true) { id } }`, { r: id, s });
const done = await gql(`query($id: ID!) { release(id: $id) { status completedCount } }`, { id });
check(done.data.release.status === "done" && done.data.release.completedCount === 8, "all steps checked -> done (persisted)");

const info = await gql(`mutation($id: ID!) { updateAdditionalInfo(id: $id, additionalInfo: "Rollback: previous tag") { additionalInfo } }`, { id });
check(info.data.updateAdditionalInfo.additionalInfo === "Rollback: previous tag", "updateAdditionalInfo persists");

const bad = await gql(`mutation { createRelease(input: { name: "", date: "2026-10-01T00:00:00Z" }) { id } }`);
check(bad.errors?.[0]?.extensions?.code === "BAD_USER_INPUT", `empty name rejected: "${bad.errors?.[0]?.message}"`);

const del = await gql(`mutation($id: ID!) { deleteRelease(id: $id) }`, { id });
check(del.data.deleteRelease === id, "deleteRelease");
const gone = await gql(`query($id: ID!) { release(id: $id) { id } }`, { id });
check(gone.data.release === null, "deleted release is gone");
console.log(`\nAll checks passed against ${API_URL}`);
