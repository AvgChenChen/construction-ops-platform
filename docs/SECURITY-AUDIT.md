# Mills security audit

This is an engineering checklist, not legal advice or a security certification.

## Current controls

- Mock-only outbound behavior; no SMS, email, or live provider calls in the MVP.
- Human approval is required before a mock message is recorded.
- Server-side session resolution and account-scoped authorization.
- Origin checks on state-changing routes.
- Zod validation and parameterized PostgreSQL queries.
- Audit events for Mills state changes.
- Encrypted backups with separate restore targets.
- Aggregate-only protected metrics.
- Secure baseline response headers and a Content Security Policy.

## Highest-risk areas before production

1. Review draft Terms, Privacy, acceptable-use, IP/DMCA, and retention documents with qualified counsel.
2. Keep Gmail, Outlook, Sheets, payment, and model integrations disabled until provider-specific consent, scopes, and webhook tests exist.
3. Add a private upload route only after size, magic-byte, malware, storage, and tenant-access checks are implemented.
4. Redact personal data and credentials from logs and telemetry.
5. Run dependency scanning and an authorized staging ZAP scan before exposing the service publicly.
6. Test backup restoration on a schedule and document incident response.

## Deliberately deferred

- BullMQ/Temporal migration: the current local worker is sufficient for the pilot.
- Langfuse/Sentry/OpenTelemetry production export: enable only after a data-redaction review and explicit configuration.
- Live outbound messaging and external OAuth accounts.

## Dependency note

`npm audit --audit-level=high` currently reports four moderate transitive `esbuild` findings through the pinned Drizzle migration toolchain. The available forced remediation upgrades `drizzle-kit` across a breaking-version boundary, so it is intentionally deferred for a separately tested dependency-upgrade change.
