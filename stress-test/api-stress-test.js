/**
 * Stress test for the Release Checklist GraphQL API.
 *
 * Sends the exact `Releases` query the frontend's list page sends, at
 * increasing concurrency levels, and records throughput, latency and errors.
 *
 * Usage:
 *   API_URL=https://your-api/graphql LABEL=before node api-stress-test.js
 *   LEVELS=10,25,50 DURATION=15 node api-stress-test.js
 *
 * An error is any of: socket error, request timeout, non-2xx status, or a
 * 2xx response whose body contains a GraphQL `errors` array (GraphQL servers
 * often return 200 for resolver failures, so status codes alone lie).
 */
import autocannon from "autocannon";
import { writeFileSync, mkdirSync } from "node:fs";

const API_URL = process.env.API_URL ?? "http://localhost:4000/graphql";
const LEVELS = (process.env.LEVELS ?? "10,25,50,100,200,500").split(",").map(Number);
const DURATION = Number(process.env.DURATION ?? 20); // seconds per level
const TIMEOUT = Number(process.env.TIMEOUT ?? 10); // seconds before a request counts as failed
const LABEL = process.env.LABEL ?? "run";
const PAUSE_MS = 3000; // let the server settle between levels

// Identical to frontend/src/graphql/operations.ts -> GET_RELEASES
const QUERY = `query Releases {
  releases {
    ...ReleaseListFields
  }
}
fragment ReleaseListFields on Release {
  id
  name
  date
  status
  completedSteps
  completedCount
  totalSteps
}`;
const BODY = JSON.stringify({ operationName: "Releases", query: QUERY });

function pct(sorted, p) {
  if (!sorted.length) return null;
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
}

function runLevel(connections) {
  let graphqlErrors = 0;
  let bytes = 0;
  const latencies = []; // ms, every response received (any status)
  return new Promise((resolve, reject) => {
    const instance = autocannon(
      {
        url: API_URL,
        connections,
        duration: DURATION,
        timeout: TIMEOUT,
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        requests: [
          {
            body: BODY,
            onResponse: (status, body) => {
              bytes += body.length;
              if (status >= 200 && status < 300 && body.includes('"errors":[')) graphqlErrors++;
            },
          },
        ],
      },
      (err, r) => {
        if (err) return reject(err);
        latencies.sort((a, b) => a - b);
        // r.requests.total = responses received; r.errors = socket errors incl. timeouts
        const attempted = r.requests.total + r.errors;
        const failed = r.errors + r.non2xx + graphqlErrors;
        const avg = latencies.length ? latencies.reduce((a, b) => a + b, 0) / latencies.length : null;
        resolve({
          concurrency: connections,
          durationSec: DURATION,
          requestsPerSec: +(r.requests.total / DURATION).toFixed(1),
          successPerSec: +((attempted - failed) / DURATION).toFixed(1),
          latencyAvgMs: avg === null ? null : +avg.toFixed(1),
          latencyP50Ms: pct(latencies, 50),
          latencyP95Ms: pct(latencies, 95),
          latencyP99Ms: pct(latencies, 99),
          latencyMaxMs: latencies.at(-1) ?? null,
          attempted,
          successful: Math.max(0, attempted - failed),
          failed,
          timeouts: r.timeouts,
          non2xx: r.non2xx,
          graphqlErrors,
          errorRatePct: attempted ? +((failed / attempted) * 100).toFixed(2) : 0,
          avgResponseKB: r.requests.total ? +(bytes / r.requests.total / 1024).toFixed(1) : 0,
        });
      },
    );
    instance.on("response", (_client, _status, _bytes, responseTime) => latencies.push(Math.round(responseTime)));
    process.once("SIGINT", () => instance.stop());
  });
}

const results = [];
console.log(`Target ${API_URL} | ${DURATION}s per level | timeout ${TIMEOUT}s | label "${LABEL}"`);
for (const c of LEVELS) {
  process.stdout.write(`  ${String(c).padStart(4)} concurrent ... `);
  const res = await runLevel(c);
  results.push(res);
  console.log(
    `${res.requestsPerSec} req/s | avg ${res.latencyAvgMs}ms | p95 ${res.latencyP95Ms}ms | p99 ${res.latencyP99Ms}ms | ` +
      `ok ${res.successful} | failed ${res.failed} (${res.errorRatePct}%)`,
  );
  await new Promise((r) => setTimeout(r, PAUSE_MS));
}

mkdirSync(new URL("./results/", import.meta.url), { recursive: true });
const out = { label: LABEL, target: API_URL, date: new Date().toISOString(), durationSec: DURATION, timeoutSec: TIMEOUT, results };
writeFileSync(new URL(`./results/${LABEL}.json`, import.meta.url), JSON.stringify(out, null, 2));

console.log("\n| Concurrency | Req/s | Avg (ms) | p95 (ms) | p99 (ms) | OK | Failed | Error rate |");
console.log("|---:|---:|---:|---:|---:|---:|---:|---:|");
for (const r of results)
  console.log(`| ${r.concurrency} | ${r.requestsPerSec} | ${r.latencyAvgMs} | ${r.latencyP95Ms} | ${r.latencyP99Ms} | ${r.successful} | ${r.failed} | ${r.errorRatePct}% |`);
console.log(`\nSaved results/${LABEL}.json`);
