# ADR 0001: Other companies' records are "not found", never "forbidden"

**Status:** Accepted · **Date:** 2026-11-03

## Context

Every contractor's data lives in one database, separated by `organizationId`. Record ids show up in URLs (`/projects/<id>`), in the schedule export, and in anything a user copies, screenshots or forwards. So sooner or later, someone signed in to company B will request an id that belongs to company A.

The app can answer that request in two ways:

- **403 Forbidden:** "this exists, but you can't see it."
- **404 Not Found:** "there's nothing here for you."

The 403 answer confirms that the id is real and belongs to another customer. Ids are random (`cuid()`), so guessing them is impractical, but leaked ids are not. A confirmed-existing id tells an attacker which records are worth more effort, and it is exactly what an authorization bug would need to be exploitable.

## Decision

**A request for another company's record behaves exactly like a request for an id that doesn't exist.** Code inside one company still uses FORBIDDEN where the caller already knows the record exists. For example, a non-owner trying to archive a project gets `forbidden("Only an account owner can archive or restore projects")` in `setProjectArchived`.

How a request for company A's project, made by company B, is handled:

1. **The page** `src/app/(app)/projects/[projectId]/page.tsx` calls `orNotFound(getProjectDetail(user, projectId))`.
2. **The read** `getProjectDetail` in `src/server/services/projects.ts` queries `findFirst({ where: { id: projectId, organizationId: ctx.orgId } })`. The company is part of the query itself, so a record from another company is never loaded.
3. **The writes** go through `findProjectOrThrow(tx, ctx, projectId)` in the same file, which is the single place that turns `(ctx, projectId)` into a project row. It throws `notFound("Project")` when the scoped query returns nothing.
4. **The error** `notFound()` in `src/server/services/errors.ts` creates `AppError("NOT_FOUND", …)`. The comment next to it records this rule.
5. **The response:**
   - Pages: `orNotFound` in `src/server/auth/current.ts` turns `NOT_FOUND` into Next.js `notFound()`, a real 404 page.
   - The API: `GET /api/projects/[projectId]/schedule-export` returns `404 {"error": "Project not found"}`.

Because the company filter is in the query, both cases ("doesn't exist" and "belongs to someone else") run the same single query and get the same empty result. No second lookup reveals the difference through timing.

**Proof**, in `tests/integration/tenant-isolation.test.ts`, run against real PostgreSQL:

- `reports other companies' records as NOT_FOUND, never FORBIDDEN, so ids don't leak`: company B requests company A's task detail and schedule export, and both return `NOT_FOUND`.
- `does not list or read another company's projects`: B's project list is empty, and `getProjectDetail` for A's project returns `NOT_FOUND`.
- `is also enforced by the database: composite foreign keys reject cross-tenant rows`: even code that skipped the service layer couldn't attach B's task to A's project.

## Alternatives considered

### 403 Forbidden

This is the more honest-sounding answer, and slightly easier to debug. **Rejected** because it confirms that an id exists in another account. A leaked URL from a screenshot becomes "a real record at company A" instead of a dead link.

### Check ownership after loading (load by id, then compare `organizationId`)

The natural first version is `findUnique({ where: { id } })` followed by an `if`, which can return either 403 or 404. **Rejected** because every new code path has to remember the `if`, and the one that forgets leaks data. It also loads the other company's row into memory. Putting `organizationId` in the `where` clause means a forgotten check returns nothing, not someone else's record.

### Throw FORBIDDEN in services, map it to 404 at the edge

Keep the precise error internally and translate it in each route. **Rejected** because the translation has to happen in every page, action and API route. A new route that forgets it reintroduces the leak, and the integration tests check service results, where the leak would look correct.

### Company in the URL (`/orgs/<org>/projects/<id>`)

This makes the scope visible and helps people who belong to several companies. **Rejected for now** because it doesn't remove the need for the scoped query: the server still can't trust the org in the URL. It also exposes organization ids, and every user here belongs to exactly one company.

## Consequences

**Good**
- A leaked or guessed id reveals nothing about other customers.
- There is one rule and one helper (`notFound`), so new code gets the safe behaviour by default.
- The rule is enforced twice: in the queries, and by composite foreign keys in Postgres. Both are tested.

**Costs**
- **Harder support and debugging.** A user who pastes a link from the wrong account sees "not found" with no hint why, and support can't tell "wrong id" from "wrong company" from the response alone. Telling them apart means checking the database or logs.
- **Tests must check the error code.** A regression from `NOT_FOUND` to `FORBIDDEN` would still "deny access", so only an assertion on the exact code catches it. The integration test above does this.
- **Two error codes with different meanings to keep straight.** `NOT_FOUND` is for anything outside your company. `FORBIDDEN` is only for actions on your own company's records that your role doesn't allow.
