# Mills security audit

Engineering checklist, last updated 2026-11-09. Not legal advice and not a security certification.

## Scope reviewed

`package.json`, `src/lib/schema.ts` and `db/migrations/` (0000–0011), `src/lib/auth.ts`, `src/lib/identity/oidc.ts`, every route under `src/app/api/`, `src/lib/mills/service.ts`, `scripts/worker.ts`, `src/lib/ops/backup.ts` and the backup/restore scripts, `tests/`, `Dockerfile`, `compose.yaml`, `deploy/`, `.env.example`, `next.config.ts`, and the audit and approval paths.

## What already exists

| Area | Control | Where |
| --- | --- | --- |
| Mock mode | No email, SMS or provider adapters exist. A "send" records a `SENT_MOCK` row. | `service.ts` `recordMockMessage` |
| Human approval | `approved: z.literal(true)` is required to record a mock message; the UI requires a review checkbox first. | `service.ts`, `mills-pilot.tsx` |
| Authentication | Local loopback password (dev only) and production OIDC with PKCE, nonce, state binding, issuer check and an immutable subject allowlist. | `auth.ts`, `oidc.ts`, `ops/config.ts` |
| Sessions | 256-bit random token, only the SHA-256 hash is stored, 8 hour absolute limit, 30 minute idle timeout, server-side revocation, `ops:revoke-sessions`. | `auth.ts` |
| Cookies | `HttpOnly`, `SameSite=Lax`, `Secure` on HTTPS origins, `Path=/`. | `cookieOptions()` |
| CSRF | Exact `Origin` match on every POST route; SameSite cookies. | `validOrigin()` |
| Open redirects | Internal-path only, no `/api`, tab/newline tricks rejected. | `safeRedirectPath()` |
| Authorization | Server-side actor resolution, account membership + status, operator role, job ownership and composite trade-membership checks. | `service.ts` |
| Tenant isolation | Integration tests for cross-account reads/writes and contractor least privilege. | `tests/mills-service.test.ts` |
| Validation / SQL | Zod on every command; parameterized `pg` queries throughout. | `service.ts` |
| Audit | Account-scoped `mills_audit_event` for every Mills mutation; auth events in `task_event`. | `recordAudit()` |
| Headers | CSP, `nosniff`, `X-Frame-Options: DENY`, `frame-ancestors 'none'`, `Referrer-Policy`, `Permissions-Policy`, COOP/CORP, `no-store`, HSTS only for HTTPS production. | `next.config.ts` |
| Errors | Route handlers return fixed strings, never stack traces. | `src/app/api/**` |
| Backups | AES-256-GCM encrypted dumps, session tables excluded, restore only into an empty, separately named `_restore` database. | `ops/backup.ts` |
| Monitoring | Generic health probes; bearer-protected, aggregate-only metrics. | `ops/monitoring.ts` |
| Rate limiting | PostgreSQL-backed fixed-window throttle for login and OIDC start. | `allowLogin()` |

## What was missing (fixed in this change)

| Gap | Fix |
| --- | --- |
| No request body size limit on JSON routes | `readJsonBody()` caps bodies (16 KB commands, 1 KB contractor), 413 on overflow, 400 on malformed JSON. Login form capped at 4 KB. |
| Mutation routes not rate limited | Per-actor throttle on `/api/mills` (60/min) and `/api/mills/contractor` (30/min) using the existing PostgreSQL throttle. |
| Failed sign-ins not audited | `AUTH_SIGN_IN_FAILED` and `AUTH_OIDC_FAILED` events (type and mode only, never the submitted value). |
| Phone numbers not redacted from logs | Redaction now covers phone numbers as well as emails, bearer tokens, JWTs and `key=value` secrets. |
| Upload helpers incomplete | Filename normalization, extension allowlist, random tenant-prefixed storage keys, traversal guard, malware-scan boundary (quarantine by default), expiring signed download links, attachment-only download headers. |
| Webhook replay/idempotency missing | `verifyWebhook()` verifies HMAC over `timestamp.rawBody` before parsing, checks freshness, account scope and first-seen event id. |
| No AI worker contract | `guardWorkerResult()` enforces the structured result contract, tool allowlist, approval status, tenant scope, and blocks override text and links. |
| Thin metrics | Auth/OIDC failure counts, worker consecutive failures, heartbeat age, backup failures, restore drill age. |
| No OSV or secret scanning | `security:*` npm scripts and CI jobs for OSV-Scanner and Gitleaks. |
| Legal documents absent | Five drafts in `docs/*-DRAFT.md`, all marked for professional review. |

## Highest-risk areas (in order)

1. **Legal drafts unreviewed.** Mills is not incorporated; the contracting party, governing law and liability terms need a lawyer before any paying customer.
2. **CSP allows `'unsafe-inline'` scripts.** Next.js needs nonces to remove it. React escaping and the absence of `dangerouslySetInnerHTML` (tested) are the current XSS defence.
3. **One local operator identity.** Local mode maps every login to `local-operator`; production OIDC needs per-person memberships before more than one GC uses it.
4. **Discovery contacts hold personal data** (name, company, email). Export/delete tooling does not exist yet; retention is manual.
5. **Webhook replay guard is in-memory.** Fine while no provider is connected; it must move to a database table before the first live webhook.
6. **Dependency audit is not clean.** Four moderate `esbuild` advisories via `drizzle-kit` (dev-only toolchain). `npm audit --audit-level=high` passes.

## Recommended next fixes (not done here)

- Adopt CSP nonces through Next.js middleware and drop `'unsafe-inline'` from `script-src`.
- Add an account data export and delete command before onboarding a second GC.
- Move the replay guard to a unique-indexed `webhook_event` table in the same change that adds the first live webhook route.
- Upgrade `drizzle-kit` in its own tested change to clear the `esbuild` advisories.
- Use the `__Host-` cookie prefix once production runs only on HTTPS (it changes the cookie name, so it signs everyone out once).

## Deliberately deferred

| Item | Why |
| --- | --- |
| BullMQ / Redis | See "Background processing decision" below. |
| Temporal | No long-running durable workflows exist. |
| Upstash rate limiting | One app instance; the PostgreSQL throttle is enough. Revisit if Mills runs more than one web instance behind a load balancer *and* the database becomes the bottleneck. |
| Sentry / OpenTelemetry SDKs | Not installed. Metrics and redacted JSON logs cover the pilot. See `OBSERVABILITY.md` for how to add one later. |
| Promptfoo, Langfuse | No model is called. The offline Vitest suite (`tests/ai-safety.test.ts`) covers the guard. Add Promptfoo with a mocked/local provider when the first AI worker exists. |
| `file-type` package | The four allowed types are detected with a few lines of magic-byte checks. Add `file-type` only if the allowlist grows (e.g. DOCX/XLSX, which are ZIP containers). |
| Public upload route | Not enabled. Utilities only. |

## Background processing decision (Phase 8)

The worker (`scripts/worker.ts`) is a single process that runs a maintenance tick every 3 seconds: it deletes expired sessions, login states and throttle rows, and writes a heartbeat. It has no queue, no retries that matter (the next tick retries), no delayed jobs and no fan-out. It is reliable for the pilot and is monitored through the heartbeat metrics.

**Decision: keep the current worker.** Do not add BullMQ, Redis or Temporal. Reconsider BullMQ only when Mills needs real retries with backoff, delayed sends, concurrency limits, deduplication or more than one worker process — most likely when live SMS/email delivery is approved. Reconsider Temporal only for multi-day workflows with human approval steps that must survive restarts. If either is proposed, the proposal must document why the current worker is insufficient, operating cost, new environment variables, new failure modes, the migration plan, mock-mode behaviour and rollback.

## Dependency and license summary

Direct runtime dependencies: `next` (MIT), `react`/`react-dom` (MIT), `pg` (MIT), `drizzle-orm` (Apache-2.0), `openid-client` (MIT), `zod` (MIT), `dotenv` (BSD-2-Clause), `lucide-react` (ISC), `tsx` (MIT). Dev: `vitest`, `@playwright/test` (Apache-2.0), `typescript` (Apache-2.0), `drizzle-kit`, `tailwindcss`, `embedded-postgres` (MIT, pre-release `18.4.0-beta.17`).

Across the lockfile: 216 MIT, 24 MPL-2.0 (`lightningcss` via Tailwind; file-level copyleft, unmodified use is fine), 23 Apache-2.0, 14 packages that include LGPL-3.0 (`@img/sharp-libvips-*` prebuilt binaries used by Next.js image optimization; dynamically linked, unmodified), plus ISC/BSD/0BSD and one CC-BY-4.0 data package (`caniuse-lite`). No GPL/AGPL. **Have a lawyer confirm** that shipping the LGPL libvips binaries inside the Docker image is acceptable for a commercial service; the usual answer is yes for unmodified dynamic linking, but that is a legal call.

No new dependencies were added in this change.
