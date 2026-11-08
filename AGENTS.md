# Mills engineering rules

- Mills is the active product. Keep the public landing page, HQ, operator pilot, and contractor workspace focused on construction coordination.
- Mock mode is the default. Never send SMS, email, or other external messages from local development.
- Every outbound-style action requires an explicit human approval. A contractor status check-in is a saved review signal, not a sent message.
- Resolve the server-side session actor for every authenticated request. Enforce active account membership, account status, role, trade membership, job ownership, and Origin checks in server-side services.
- All state-changing Mills commands go through a transaction and write an account-scoped audit event.
- Keep contractor responses least-privilege. Do not expose HQ contact details, phone numbers, or other account-wide records to a trade-scoped actor.
- Keep local and production authentication separate. Loopback passwords are for development only. Production uses HTTPS OIDC with immutable subject allowlisting.
- Use parameterized SQL, validated Zod input, explicit status transitions, and composite account/job checks for trade membership records.
- Preserve migration history. Never reset the local or test database to make a migration pass. Add a forward migration and test it against a dedicated database ending in `_test`.
- Keep health probes generic and metrics aggregate-only. Do not log credentials, cookies, OAuth codes, contact details, message bodies, or provider responses.
- Before declaring a change complete, run migrations, typecheck, PostgreSQL integration tests, the production build, and Playwright browser tests.

## Deployment boundary

The current MVP is local-first and mock-only. Invite management, persisted HQ customer records, live provider adapters, outbound messaging, and offsite backup replication are intentionally not part of this build.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
