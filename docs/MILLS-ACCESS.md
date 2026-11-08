# Mills access boundary

The Mills MVP has two authenticated views with different data scopes.

## Operator workspace

`/api/mills` resolves the session actor on the server, checks an active `mills_membership`, and only then reads or mutates jobs and discovery contacts in that account. Operator mutations are limited to `OWNER`, `OPS`, `GC`, or `OPERATOR` memberships. Every trade update, discovery contact change, and approved mock message writes a row to `mills_audit_event` in the same database transaction.

## Contractor workspace

`/api/mills/contractor` resolves an active `mills_trade_membership`. The response includes the assigned trade summary, that trade's tasks, and approved messages addressed to the assigned trade. It intentionally omits trade contact details and phone numbers. A contractor can update only the assigned trade. The update is still mock-only and does not send SMS or email.

## Local preview behavior

The migration creates one `mills-local` account. The first local workspace read seeds the Bloor renovation pilot, its four trades, and the local operator membership. The local operator receives preview trade memberships so `/contractor` works without an invite flow.

## Remaining boundary work

- Add an operator-only invite and revoke flow for real contractor identities.
- Persist the HQ customer directory and onboarding checklist instead of the current local mock records.
- Add explicit role management UI and a read-only audit timeline in HQ.
- Replace the seeded local preview with an account created during onboarding.

Until those pieces are implemented, keep Mills in mock mode and require human approval for every outbound message.
