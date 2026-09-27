# Demo script (about 3.5 to 4 minutes)

Recording setup: camera on (face visible in a corner), screen shows a browser and a terminal side by side. Replace `<app>` and `<api>` with your deployed URLs.

**Before recording**

- Warm the API: open `https://<api>.onrender.com/health` (free tier sleeps).
- Have two terminals open in `stress-test/`.
- The "before" numbers come from the baseline commit. To show it live, run the baseline on your machine in a spare terminal:
  `git worktree add ../baseline v1-baseline && cp backend/.env ../baseline/backend/.env && cd ../baseline/backend && npm install && npm run build && PORT=4001 npm start`
  (same database as your local copy, seeded with `SEED_COUNT=1000 SEED_RESET=1 npm run seed`). Run the optimised version on port 4000.
- If you'd rather run both against the cloud, deploy `v1-baseline` as a second Render service. Either way, test both versions on the **same** machine or host, otherwise the comparison means nothing.

---

## 1. Introduction (0:00 to 0:20)

> Hi, I'm Tanmay. This is the Release Checklist Tool I built for the assignment. It's a small app for walking every release through the same eight steps, code freeze through production verification, and it works out the release status from which steps are done. I'll show the app, the GraphQL API, and then the part I found most interesting, which is load testing it, finding where it broke, and fixing that.

## 2. Architecture (0:20 to 0:45)

*Show the Architecture section of the README.*

> It's React with Apollo Client on the front, talking GraphQL to a Node server running GraphQL Yoga, with Prisma and Postgres underneath. There's only one table. The steps are the same for every release, so they live in code, and each release stores the IDs of the steps it's completed as a JSONB array. Status isn't stored at all. One function on the server derives it: nothing done is planned, some done is ongoing, all done is done. That way it can never get out of sync.

## 3. Application demo (0:45 to 1:35)

*Open `https://<app>.vercel.app`.*

> This is the deployed app. Each row shows the due date, the status, and this little track, which has one segment per step, so you can see which steps are done, not just a percentage.

*Click New release, click Create with an empty form.*

> Validation first: name and date are required.

*Fill in "Version 2.5.0", pick a date, add a note, create.*

> It shows up in the list. Let me open it.

*Tick the first step.*

> One step done and it flips to ongoing. That status came back from the server, the browser doesn't calculate it.

*Tick the rest quickly.*

> All eight and it's done. If I untick one, it goes back to ongoing.

*Edit additional information, save, then refresh the page.*

> I'll edit the notes, save, and refresh, and it's persisted. Last thing, delete, with a confirmation.

*Delete it. Optionally shrink the window to phone width for two seconds.*

> And it's responsive, so on a phone the rows turn into cards.

## 4. GraphQL API demo (1:35 to 2:05)

*Terminal:*

```bash
curl -s https://<api>.onrender.com/graphql -H 'content-type: application/json' \
  -d '{"query":"{ releases(limit: 3) { name status completedCount totalSteps } releaseCount }"}'

API_URL=https://<api>.onrender.com/graphql node smoke-test.js
```

> Here's the API directly. A list query, and then a little script I wrote that goes through the whole flow against the deployed endpoint: create, toggle steps, check it goes planned, ongoing, done, update the notes, send an empty name to check it gets rejected with a proper error, and delete. All green.

## 5. Initial stress test and breaking point (2:05 to 2:50)

*Terminal, baseline running on port 4001:*

```bash
API_URL=http://localhost:4001/graphql LABEL=demo-before LEVELS=10,50,200,500 DURATION=10 node api-stress-test.js
```

> Now load. This fires the exact query the list page sends, at rising numbers of concurrent users, with 1000 releases in the database. This is the first version.

*While it runs, point at the output.*

> At ten users it's already doing only about forty requests a second, and that number doesn't move as I add users. The latency just keeps climbing. That means it's saturated almost immediately. At two hundred users requests start timing out, around thirteen percent in my run, and at five hundred more than half fail.

## 6. What caused it, and the fix (2:50 to 3:25)

*Show the Investigation table in the README.*

> So I profiled a single request. Postgres was answering in under a millisecond, so the database wasn't the problem, and there was no N+1, and the pool wasn't exhausted. The time was all in Node: every list request was loading all thousand releases, including the notes field it didn't even display, resolving about seven thousand GraphQL fields and sending back 227 kilobytes. That's around twenty-two milliseconds of blocking work on the event loop per request, which caps a single core at roughly forty-five a second.
>
> The fix was mostly doing less work. The list is paginated now, fifty at a time with a load more button. The resolver skips the notes column when the query doesn't ask for it. Each row's steps are parsed once instead of three times, and I added an index that matches the sort order so paging stays cheap as the table grows.

## 7. Final stress test and comparison (3:25 to 3:55)

```bash
API_URL=http://localhost:4000/graphql LABEL=demo-after LEVELS=10,50,200,500 DURATION=10 node api-stress-test.js
```

> Same test, same data, same machine. Now it's around five hundred requests a second, about eleven times more, and zero errors at five hundred users. The p95 at a hundred users went from two and a half seconds to about a quarter of a second. Pushing further, it only started dropping requests at around four thousand concurrent users.

*Show the before/after table in the README.*

> The full numbers are in the README. One honest caveat: these ran on a single-core machine with the load generator on the same box, so the absolute numbers aren't a production benchmark, but the comparison is apples to apples.

## 8. Conclusion (3:55 to 4:10)

> So that's it: the app, GraphQL API, Postgres with Prisma, Docker setup, tests, and the load test before and after. The design decisions and trade-offs are all written up in the README. Thanks for watching.

---

### If something goes wrong on camera

- API slow on the first request: that's the free-tier cold start, mention it and retry.
- Numbers differ from the README: they will on different hardware. Say what you see; the shape (flat, low throughput and timeouts before; roughly 10x after) is what matters.
