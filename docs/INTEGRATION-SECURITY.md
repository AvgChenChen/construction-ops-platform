# Integration security boundary

**No live integration is enabled.** Gmail, Outlook, Google Sheets, calendars, payments, SMS and model providers are all off. Nothing in this repository holds a provider credential.

## Rules before enabling any provider

- Disabled by default; enabled only by an explicit env var per provider, and only after founder approval.
- Minimum OAuth scopes; refresh tokens encrypted at rest and never logged.
- Explicit connect, disconnect and revoke actions; one provider account belongs to one Mills account.
- Human approval before any external send, submission, contact or calendar event. The model never sends anything.
- Mock adapters and contract tests stay the default test path.
- Store provider ids, not raw payloads, unless a documented feature needs the payload.

## Webhooks — use `verifyWebhook()` (`src/lib/ops/signatures.ts`)

1. Read the **raw body** (`await req.text()`, capped) — do not `req.json()` first.
2. Verify HMAC-SHA256 over `${timestamp}.${rawBody}` with the per-provider secret (constant-time compare).
3. Reject timestamps older or newer than 5 minutes.
4. Parse only after verification; require an event `id` and the expected `accountId`.
5. Reject duplicates by `provider:account:eventId` (idempotency). *Shortcut:* the guard is in-memory; replace with a unique-indexed `webhook_event` table in the same change that adds the first live webhook route.
6. On any failure return a generic 4xx, write an account-scoped audit event (no payload), and do nothing else.
7. Provider-specific schemes (e.g. Stripe's `t=…,v1=…` header) get a thin adapter that feeds the same steps.

Test fixtures for valid, tampered, expired, wrong-account, malformed and replayed events are in `tests/security-hardening.test.ts`.

## Configuration still needed per provider

OAuth consent screen, redirect URIs, scopes, webhook secret, privacy-policy subprocessor entry, data-processing terms, and an incident owner. None of these exist yet; creating them is a founder decision.
