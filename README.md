# Mills

Mills is a mock-first coordination workspace for residential general contractors and the trades they manage. It keeps one job schedule visible, highlights downstream impact, and prepares updates for human approval before anything is sent.

The active product is Mills only. The old internship workflow is no longer linked or shipped as an application route. Historical database migrations remain in place so existing local databases can upgrade safely.

## Quick start

Use Node 22.12 or newer.

```sh
npm ci
cp .env.example .env
```

Set a strong `DASHBOARD_PASSWORD` in `.env`. Then start the local database and app in separate terminals:

```sh
npm run db:local
npm run db:migrate
npm run dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000). The local password gate is loopback-only. Keep the exact `127.0.0.1` host because it must match `APP_ORIGIN` and the mutation origin check.

Run the Mills maintenance worker in another terminal:

```sh
npm run worker
```

The worker cleans expired sessions and maintains the Mills health heartbeat. It does not send messages or run external integrations.

## Product surfaces

- `/` is the public Mills overview and illustrative mock demo.
- `/hq` is the internal headquarters for pilot health, discovery, and onboarding.
- `/mills` is the operator pilot console for trades, dependencies, approved mock updates, and discovery contacts.
- `/contractor` is a trade-scoped workspace showing assigned tasks, dependencies, approved updates, and a status check-in.

All three authenticated surfaces stay mock-only. No SMS, email, or customer message is sent.

## Backend boundary

The active API is deliberately small:

- `GET/POST /api/mills` resolves the server-side session actor, requires an active account membership and operator role, and scopes every read and mutation to that account.
- `GET/POST /api/mills/contractor` requires an active trade membership, returns only the assigned trade view, and permits status changes for that trade only.
- `GET /api/health/live` is a public liveness probe.
- `GET /api/health/ready` checks configuration, PostgreSQL, and the Mills worker heartbeat.
- `GET /api/metrics` requires the monitoring bearer token and exposes aggregate Mills metrics only.

The database migration `0010_mills_tenancy.sql` adds accounts, memberships, trade memberships, and audit events. Every state-changing Mills command writes an audit row in the same transaction. See [`docs/MILLS-ACCESS.md`](docs/MILLS-ACCESS.md) for the access contract and remaining MVP boundaries.

## Mock and approval policy

Mills never contacts a trade from the local pilot. A coordinator can prepare a message, but recording a mock send requires an explicit approval flag. Contractor status changes are saved for the GC to review and do not send anything.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `TEST_DATABASE_URL` | Dedicated test database ending in `_test` |
| `DASHBOARD_PASSWORD` | Required only for loopback development login |
| `APP_ORIGIN` | Exact browser origin, default `http://127.0.0.1:3000` |
| `DEPLOYMENT_ENV` | `local` or `production` |
| `AUTH_MODE` | `local` for loopback or `oidc` for production |
| `OIDC_ISSUER` | Google or another OIDC issuer |
| `OIDC_CLIENT_ID` | Server-side OIDC client ID |
| `OIDC_CLIENT_SECRET` | Server-side OIDC client secret |
| `OIDC_ALLOWED_SUBJECTS` | Comma-separated immutable approved subject IDs |
| `MONITORING_TOKEN` | Bearer token for protected metrics |
| `BACKUP_ENCRYPTION_KEY` | 64-character hex key for encrypted backups |
| `BACKUP_DIR` | Backup directory, default `.local/backups` |
| `RESTORE_DATABASE_URL` | Separate empty PostgreSQL target used only by restore |

Live OAuth, outbound messaging, and external integrations are not part of this MVP. Keep the mock policy enabled until those paths have separate consent, review, and provider tests.

## Verification

```sh
npm run db:migrate
npm run typecheck
npm test
npm run build
npm run test:e2e
npm run ops:preflight
```

The integration suite uses real PostgreSQL and refuses to run unless `TEST_DATABASE_URL` ends in `_test`. Browser tests cover the landing page, login, operator pilot, contractor scoping, and HQ flow.

## Operations

```sh
npm run backup:create
npm run backup:restore /path/to/backup.enc recruiting_restore
npm run ops:revoke-sessions -- --all
```

Backups are encrypted and restore only into a separate empty database whose name ends in `_restore`. Docker and reverse-proxy examples are in `deploy/`.
