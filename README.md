# Release Checklist Tool

A web app for tracking the release process. Every release gets the same 8-step checklist; ticking steps updates the release status automatically (planned, ongoing, done). Releases can be created, edited, annotated with free-text notes and deleted.

## Tech stack

- **Frontend:** React 19, TypeScript, Vite, Apollo Client 3, React Router, React-Toastify, plain CSS
- **Backend:** Node.js, TypeScript, GraphQL Yoga, Prisma 7 (`@prisma/adapter-pg`)
- **Database:** PostgreSQL 16
- **Tests:** Vitest (unit + GraphQL integration tests against a real database)
- **Load testing:** autocannon
- **Infra:** Docker, docker compose, GitHub Actions; deployment config for Render (API), Neon (DB), Vercel (frontend)

Node **20.19+ or 22.12+** is required (Vite 8 and Prisma 7 minimums). Docker and CI use Node 22.

```text
React + Apollo Client ──GraphQL (POST /graphql)──▶ GraphQL Yoga ──▶ Prisma ──▶ PostgreSQL
```

## Project structure

```text
backend/
  prisma/                 schema.prisma + migrations
  src/domain/             steps.ts (the 8 steps), status.ts (getReleaseStatus)
  src/graphql/            typeDefs, resolvers, validation, errors, DateTime scalar
  src/app.ts, server.ts   Yoga setup, CORS, HTTP server, /health
  src/seed.ts             sample data
  tests/
  Dockerfile
frontend/
  src/pages/              ReleaseList, ReleaseDetail
  src/components/         StepTrack, StatusBadge, Modal, ReleaseForm, ConfirmDelete, States
  src/graphql/operations.ts
stress-test/
  api-stress-test.js      autocannon load test
  smoke-test.js           end-to-end API check against any URL
  results/                recorded results used below
docker-compose.yaml, render.yaml, .github/workflows/ci.yml, .env.example
```

## Features

- List releases (newest due date first) with status, due date and progress; 50 per page with "Load more"
- Create a release (name and due date required, notes optional); names must be unique
- Detail page with the checklist, progress, status and notes
- Check/uncheck steps; status is recalculated by the server
- Edit notes, name and due date
- Delete with confirmation
- Loading, empty, error and not-found states; toast feedback; client and server validation
- Responsive: table on desktop/tablet, cards on mobile

## Database schema

Single `Release` table:

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID` | primary key |
| `name` | `VARCHAR(200)` | required, **unique** |
| `date` | `TIMESTAMPTZ(3)` | required (due date) |
| `additionalInfo` | `TEXT` | optional, max 5000 chars |
| `completedSteps` | `JSONB` | array of step IDs, default `[]` |
| `createdAt`, `updatedAt` | `TIMESTAMPTZ(3)` | |

Indexes: unique on `name`, and `("date" DESC, "id")` for the paginated list.

Migrations: `init`, `unique_release_name`, `release_date_index`.

### Steps and status

The steps are fixed and identical for every release, so they're defined in `backend/src/domain/steps.ts` instead of a table:

`code-freeze`, `automated-tests`, `pr-review`, `changelog`, `production-build`, `env-vars`, `deploy`, `verify-production`.

Status is never stored. `getReleaseStatus()` in `backend/src/domain/status.ts` derives it on every read:

| Completed steps | Status |
|---|---|
| 0 | `planned` |
| 1 to 7 | `ongoing` |
| 8 | `done` |

Unknown or duplicate IDs in `completedSteps` are ignored.

## GraphQL API

Endpoint: `POST /graphql`. GraphiQL is enabled outside production. Health check: `GET /health`.

```graphql
type Query {
  releases(limit: Int = 50, offset: Int = 0): [Release!]!   # newest first, limit 1..100
  releaseCount: Int!
  release(id: ID!): Release                                 # null if not found
  steps: [Step!]!
}

type Mutation {
  createRelease(input: CreateReleaseInput!): Release!           # name!, date!, additionalInfo
  updateRelease(id: ID!, input: UpdateReleaseInput!): Release!  # any of name, date, additionalInfo
  toggleStep(releaseId: ID!, stepId: ID!, completed: Boolean): Release!
  updateAdditionalInfo(id: ID!, additionalInfo: String): Release!  # null or "" clears it
  deleteRelease(id: ID!): ID!
}
```

`Release` exposes `id, name, date, status, additionalInfo, completedSteps, completedCount, totalSteps, steps { id order name description completed }, createdAt, updatedAt`.

`toggleStep` sets the step when `completed: true`, clears it when `false`, and flips it when omitted.

Errors:

| Case | `extensions.code` |
|---|---|
| Empty/too long name, unknown step, invalid notes, bad `limit`/`offset` | `BAD_USER_INPUT` |
| Duplicate name (create or rename) | `CONFLICT` |
| Release doesn't exist (mutations) | `NOT_FOUND` |
| Missing or unparseable date | GraphQL validation error |

Unexpected errors are masked as `Unexpected error.`

Examples:

```graphql
mutation {
  createRelease(input: { name: "Version 2.4.0", date: "2026-10-01T14:00:00Z" }) { id status }
}

query {
  releases(limit: 10) { id name date status completedCount totalSteps }
  releaseCount
}

query ($id: ID!) {
  release(id: $id) { name status additionalInfo steps { id name completed } }
}

mutation ($id: ID!) {
  toggleStep(releaseId: $id, stepId: "code-freeze", completed: true) { status completedCount }
}

mutation ($id: ID!) { updateAdditionalInfo(id: $id, additionalInfo: "Rollback: v2.3.9") { additionalInfo } }
mutation ($id: ID!) { deleteRelease(id: $id) }
```

```bash
curl -s http://localhost:4000/graphql -H 'content-type: application/json' \
  -d '{"query":"{ releases(limit: 5) { name status } releaseCount }"}'
```

## Local setup

```bash
cp .env.example .env
cp .env.example backend/.env
docker compose up -d db                 # Postgres on localhost:5433 (or use your own and edit DATABASE_URL)

cd backend
npm install
npx prisma migrate deploy
npm run seed                            # optional; SEED_COUNT=20 for fewer, SEED_RESET=1 to clear first
npm run dev                             # http://localhost:4000/graphql

cd ../frontend
npm install
echo "VITE_GRAPHQL_URL=http://localhost:4000/graphql" > .env.local
npm run dev                             # http://localhost:5173
```

If Vite starts on a different port, add it to `CORS_ORIGIN`.

## Docker

```bash
cp .env.example .env
docker compose up --build               # Postgres + API; migrations run when the API starts
curl http://localhost:4000/health       # ok
docker compose down                     # -v also deletes the database volume
```

The API container runs `prisma migrate deploy && node dist/server.js`. The frontend is run with `npm run dev` or deployed separately.

## Environment variables

| Variable | Used by | Purpose |
|---|---|---|
| `DATABASE_URL` | backend | Postgres connection string (required) |
| `PORT` | backend | default `4000` |
| `CORS_ORIGIN` | backend | comma-separated allowed origins, default `http://localhost:5173` |
| `DB_POOL_MAX` | backend | pg pool size, default `10` |
| `TEST_DATABASE_URL` | tests | database used by `npm test` (wiped) |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | docker compose | local Postgres credentials |
| `VITE_GRAPHQL_URL` | frontend | GraphQL endpoint, set at build time |

## Tests

```bash
docker compose exec db createdb -U postgres releases_test   # once
cd backend
export TEST_DATABASE_URL=postgresql://postgres:change-me@localhost:5433/releases_test
DATABASE_URL=$TEST_DATABASE_URL npx prisma migrate deploy
npm test
```

Without `TEST_DATABASE_URL`, `vitest.config.ts` falls back to `postgres:postgres@localhost:5433/releases_test`.

19 tests in 3 files:

- `status.test.ts`: planned / ongoing / done, plus bad stored data
- `graphql.test.ts`: create, fetch, toggle through all statuses, edit notes, delete; duplicate name on create and rename; idempotent and concurrent toggles; validation and not-found errors
- `pagination.test.ts`: default page size, non-overlapping pages, limit/offset validation, `additionalInfo` via fragments

CI runs the same tests plus both builds.

`stress-test/smoke-test.js` runs the whole flow against a running API:

```bash
cd stress-test && npm install
API_URL=http://localhost:4000/graphql node smoke-test.js
```

## Stress testing

```bash
cd stress-test && npm install
API_URL=http://localhost:4000/graphql LABEL=before node api-stress-test.js
LEVELS=10,50,100 DURATION=10 node api-stress-test.js   # options
```

**Setup:** the list page's `Releases` query (same request body before and after), 1000 seeded releases, 20 s per concurrency level, 10 s request timeout. A request fails on socket error, timeout, non-2xx, or a GraphQL `errors` array in a 200 response. Percentiles are computed from every response time.

**Environment:** run locally on a 1 vCPU / 4 GB Ubuntu VM. Node 22 API (production build, one process, `DB_POOL_MAX=10`), PostgreSQL 16 and autocannon all on the same machine. Raw results are in `stress-test/results/`.

### Before (`v1-baseline` in git history)

| Users | Req/s | Avg ms | p95 ms | p99 ms | OK | Failed | Error rate |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 10 | 44.0 | 226 | 308 | 353 | 881 | 0 | 0% |
| 25 | 42.5 | 579 | 715 | 2136 | 851 | 0 | 0% |
| 50 | 43.2 | 1125 | 1279 | 1321 | 864 | 0 | 0% |
| 100 | 42.6 | 2223 | 2492 | 2551 | 852 | 0 | 0% |
| 200 | 39.5 | 3160 | 3860 | 7954 | 791 | 120 | 13.2% |
| 500 | 36.3 | 1078* | 2806* | 8103* | 726 | 902 | 55.4% |

\* Only responses that arrived. Most requests at 500 users timed out, so the error rate is the meaningful number.

Throughput was flat at ~43 req/s from 10 users, so latency grew linearly with load. Requests started timing out at 200 users. All failures were timeouts.

**Cause:** profiling one request showed Postgres took 0.6 ms, but Node spent ~22 ms on CPU: Prisma loading all 1000 rows including the unused `additionalInfo` (13 ms), resolving ~7,000 GraphQL fields (~9 ms), and serialising a 227 KB response. On one core that caps out around 45 req/s. There were no N+1 queries and no pool exhaustion.

**Changes (`v2-optimized`):**

1. Paginate `releases` (default 50, max 100) and add `releaseCount`. Response size dropped from 227 KB to 11.5 KB.
2. Skip loading `additionalInfo` when the query doesn't select it.
3. Normalise each row's `completedSteps` once instead of per field.
4. Add a `(date DESC, id)` index matching the list order (mainly for larger tables; at 1000 rows the DB wasn't the bottleneck).

### After (same test)

| Users | Req/s | Avg ms | p95 ms | p99 ms | OK | Failed | Error rate |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 10 | 434.9 | 23 | 40 | 63 | 8,698 | 0 | 0% |
| 25 | 524.1 | 48 | 70 | 95 | 10,483 | 0 | 0% |
| 50 | 508.5 | 98 | 133 | 159 | 10,170 | 0 | 0% |
| 100 | 497.0 | 200 | 243 | 258 | 9,940 | 0 | 0% |
| 200 | 494.5 | 401 | 443 | 457 | 9,890 | 0 | 0% |
| 500 | 480.1 | 1015 | 1119 | 1234 | 9,601 | 0 | 0% |
| 1000 | 449.5 | 2123 | 2378 | 2700 | 8,990 | 0 | 0% |
| 2000 | 440.1 | 4051 | 4511 | 7545 | 8,803 | 0 | 0% |
| 4000 | 406.4 | 7520 | 9289 | 9812 | 8,127 | 235 | 2.8% |

### Summary

| Users | Before (req/s, p95, errors) | After (req/s, p95, errors) |
|---:|---|---|
| 10 | 44, 308 ms, 0% | 435, 40 ms, 0% |
| 100 | 43, 2492 ms, 0% | 497, 243 ms, 0% |
| 200 | 40, 3860 ms, 13.2% | 495, 443 ms, 0% |
| 500 | 36, n/a, 55.4% | 480, 1119 ms, 0% |

Throughput went up about 11x and the first failures moved from 200 to 4000 concurrent users.

**Limitations:** single shared core, load generator on the same machine, one read operation only, closed-loop load. Results against a hosted free tier will be lower and affected by cold starts. These runs were done before the unique-name index was added; it doesn't affect this read query.

## Deployment

Config is set up for Neon (Postgres), Render (API via `render.yaml`, Docker) and Vercel (frontend).

1. Neon: create a database and copy the connection string (with `?sslmode=require`).
2. Render: create a Blueprint from the repo, or a Docker web service with root `backend`. Set `DATABASE_URL` and `CORS_ORIGIN` (the Vercel URL, no trailing slash). Migrations run on start.
3. Vercel: import the repo with root `frontend` and set `VITE_GRAPHQL_URL=https://<api>/graphql`. `vercel.json` handles SPA routing.
4. Check: `API_URL=https://<api>/graphql node stress-test/smoke-test.js`.

| | URL |
|---|---|
| Frontend | _add after deploying_ |
| GraphQL API | _add after deploying_ |

Render's free tier sleeps when idle, so the first request can take a while.

## Design decisions

- **Steps in code, not a table.** They never change, so a table would only add joins and seed data. The API still serves them, so the UI doesn't hardcode them.
- **`completedSteps` as JSONB.** One row per release, readable, and it can be updated in place with Postgres JSONB operators.
- **Derived status.** Computed by one function on read, so it can't get out of sync with the checklist.
- **Atomic `toggleStep`.** A single `UPDATE ... CASE ... RETURNING` does the read-modify-write in Postgres, so concurrent toggles don't lose updates (covered by a test).
- **No optimistic UI for steps.** The checkbox waits for the server response rather than duplicating the status rule in the browser.
- **Unique release names.** Enforced by a database constraint and returned as `CONFLICT`.
- **Malformed IDs return `NOT_FOUND`** without hitting the database.
- **Offset pagination** with `id` as a tie-breaker. Simple and enough for this data size.
- **CORS allow-list** from env; GraphiQL disabled in production.
- **Apollo cache updates** on create/delete instead of refetching the list.

## Trade-offs

- `releases` returns 50 by default, so clients need `offset`/`releaseCount` to get everything.
- Offset pagination gets slower at deep offsets and can shift if data changes while paging.
- No authentication (single-user by design).
- Dates are stored in UTC and shown in the browser's time zone.
- Fixed steps mean no per-release custom steps.