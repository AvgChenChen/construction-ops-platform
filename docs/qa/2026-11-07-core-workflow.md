# QA: core coordination workflow — 2026-11-07

Scope: `construction-ops-platform` at `2af4414` (assumed to be the Mills app under test; no repository named Mills exists).
Environment: local only. PostgreSQL 16 (README requires 15+), Node 22.23, Next 15.5.28 production build, Playwright 1.56.1
driving a preinstalled Chromium build 1243 (not the browser Playwright 1.56 pins). No staging or production systems touched.
No AI, email, or SMS providers were called, because the app has none.

## 1. Workflow map

| # | Intended step | Status | Evidence |
|---|---|---|---|
| 1 | GC creates project and scheduled tasks | **Implemented, verified** | E2E journey (desktop + mobile) |
| 2 | Tasks name a subcontractor and dependencies | **Implemented, verified.** Gap: the server accepts any directory subcontractor, not only ones on the project | E2E; `coordination.test.ts` GAP test |
| 3 | Subcontractor reports a delay by web or SMS | **Not implemented.** Subcontractors have no login and there is no SMS. A GC user records the update on their behalf | `schema.prisma` (no sub user), no messaging code |
| 4 | Mills identifies affected downstream work | **Partial.** Computed blocked/at-risk flags with root cause, within a 5-working-day look-ahead. Delays carry no new date, and downstream dates never move | E2E step 6; `blockers.ts` |
| 5 | Mills proposes a notification or schedule change | **Not implemented.** People draft follow-ups by hand; nothing is generated; no schedule-change proposals | `followups.ts` |
| 6 | GC reviews and approves | **Implemented, verified** (owner-only approve/reject) | E2E, integration |
| 7 | Approved action executes exactly once | **Approval is recorded exactly once; nothing executes.** "Approved follow-ups are recorded, not sent" (README) | Concurrency tests |
| 8 | Outcome recorded accurately | **Draft/approve/reject are recorded.** No execution or delivery outcome exists to record | E2E activity-feed counts |

## 2. Tests added

| File | Layer | What it proves |
|---|---|---|
| `e2e/coordination.spec.ts` + `.mobile.spec.ts` (shared `e2e/support/coordination-journey.ts`) | Browser, desktop + Pixel 7 | Project, tasks, subcontractor assignment, dependency via UI; delay persists across reload; downstream task shows "At risk … waiting on Plumbing rough-in (blocked, 20%)"; unrelated subcontractor not offered; pending state before approval; member cannot approve; org B gets 404 on project, both task URLs and export API; real task id under the wrong project id is 404; approval persists after refresh with exactly one activity entry; double-click approves once; reject records rejected and never approved. Run-tagged fixtures, cleaned up afterwards (verified 0 rows left) |
| `e2e/known-defects.spec.ts` | Browser | The two hang defects below, as `test.fail()` |
| `tests/integration/coordination.test.ts` | Real Postgres | Reject transitions; 6 concurrent approvals → exactly 1 succeeds, 5 CONFLICT, 1 activity row; approve-vs-reject race has one winner; forced member approval leaves it pending; delay → downstream impact through services; follow-up cannot link a task from another job; 3 pinned "decision needed" behaviors; 1 known DB isolation defect (`it.fails`) |
| `tests/unit/timezones.test.ts` | Unit | Toronto vs Vancouver "today", spring-forward and fall-back 2026 boundaries, date-only values across DST weekends |

Config: `playwright.config.ts` gains an opt-in `PW_CHROMIUM_EXECUTABLE`, a `mobile` project limited to `*.mobile.spec.ts`,
and failure screenshots. CI: also uploads `test-results/` (traces) on failure. No new dependencies.

## 3. Defects

1. **UI never settles after a successful action on `/subcontractors` and `/dashboard`.** Data is saved (checked in DB),
   but the dialog stays "Adding…" or the button stays "Approving" indefinitely; reload shows correct state. Same actions on
   project/task pages work. Reproduced 3/3. The server responds in about 30 ms with a complete response, so it is client-side.
   Ruled out: removing `loading.tsx`, removing page `metadata`, and `htmlLimitedBots`. `next@15.5.29` appeared to fix
   dashboard approval, but it was published 4 days ago and broke the subcontractor dialog in one probe, so it was not adopted.
   **Not yet ruled out:** the newer-than-pinned Chromium. CI (pinned browser) will confirm. Impact: the README's main
   approval path (dashboard) looks broken to a GC, who may retry. Server-side approval is exactly-once, so retries do not duplicate.
2. **Database isolation is weaker than documented.** `Task.subcontractorId`, `FollowUp.subcontractorId`, `FollowUp.taskId`,
   `Issue.taskId` are single-column FKs; a direct insert linking company B's follow-up to company A's subcontractor and
   task succeeds. The service layer still blocks it (existing tests). Fix: composite FKs with `ON DELETE SET NULL (col)`
   via a hand-written migration (Prisma can't express column-list SET NULL). Not a small change; not made.
3. **Test environment only:** Playwright 1.56.1 can't find its pinned browser here. Handled by the opt-in executable path.

No application code was changed.

## 4. Decisions needed (behavior pinned by tests, not invented)

- Should approval revalidate or reject a proposal whose task changed after drafting? (Today: approves stale proposals.)
- May a follow-up or task assignment target a directory subcontractor not on the project? (UI says no, server says yes.)
- Should a successor be allowed to start before its prerequisite's planned finish? (Today: accepted silently; flagged only later.)
- Project timezone: there is one global `APP_TIMEZONE`. A Vancouver project on a Toronto deployment rolls "today" 3 hours early.
- How should a delay be expressed (new expected finish date?) so downstream impact can be computed beyond 5 working days?

## 5. Not tested / not implemented

Subcontractor-scoped access, SMS/web reporting by subs, inbound dedupe, job retries, provider timeouts, delivery status,
AI-output validation, conflicting reports, ambiguous-message clarification: **not implemented in this app**.
`field-update-ai-agent` (Python) contains extraction and guardrails but is not integrated, and was not tested here.
Postgres RLS: not present. `docker compose up`: not run.

## 6. Risks outside the workflow

- `npm run db:seed` runs `prisma.organization.deleteMany()` against whatever `DATABASE_URL` points to, guarded only by
  `NODE_ENV=production`. Pointed at a shared staging database, it deletes every tenant. Suggest refusing unless the host
  is local/CI or an explicit `ALLOW_DEMO_SEED` is set.
