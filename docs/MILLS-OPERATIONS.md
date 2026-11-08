# Mills operations runbook

This runbook is for the current Mills MVP. The product is local-first and mock-only: it stores coordination updates and prepares drafts for review, but it does not send SMS, email, LinkedIn messages, or social posts.

## Operating boundaries

- Use local password authentication only on loopback (`127.0.0.1`, `localhost`, or `::1`).
- Production authentication is HTTPS OIDC with an immutable subject allowlist. Do not use a production password gate.
- A message draft is not a message sent. Recording a mock send requires an explicit approval flag and writes `SENT_MOCK` with `MOCK` provenance.
- Contractor status check-ins are saved for the GC to review. They do not contact a trade.
- Pilot requests, discovery notes, onboarding checks, and Growth approvals are local application state. They do not contact a person or external account.
- Never put credentials, OAuth codes, cookies, contact details, or message bodies in logs, screenshots, or issue reports.

## Local startup

Use Node 22.12 or newer.

```sh
npm ci
cp .env.example .env
```

Set a strong local-only `DASHBOARD_PASSWORD`, then use separate terminals:

```sh
# Terminal 1: persistent embedded PostgreSQL on 127.0.0.1:54329
npm run db:local

# Terminal 2: apply forward migrations
npm run db:migrate

# Terminal 3: start the web app
npm run dev

# Terminal 4: keep the maintenance heartbeat alive
npm run worker
```

Open `http://127.0.0.1:3000`. Keep the exact loopback origin because the local auth and Origin checks depend on it. Verify the local configuration before testing:

```sh
npm run ops:preflight
```

The local database is persistent under `.local/` and is ignored by Git. Do not reset or delete it to work around a migration error. Add a forward migration instead.

## Production startup

Production requires:

- A managed PostgreSQL database with verified TLS (`sslmode=verify-full` and a trusted root certificate where required).
- A public HTTPS origin, normally behind Caddy or another reverse proxy.
- OIDC configuration (`OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, and immutable `OIDC_ALLOWED_SUBJECTS`).
- A `MONITORING_TOKEN` at least 32 characters long.
- A 64-character hexadecimal `BACKUP_ENCRYPTION_KEY`.

Create the deployment environment file outside source control:

```sh
cp deploy/production.env.example deploy/production.env
# edit deploy/production.env; do not commit it
```

Run the production preflight before starting containers:

```sh
npm run ops:preflight -- --production
```

The provided production compose file runs separate `web`, `worker`, and `backup` services. Run the migration job once for a new release, then start the long-running services:

```sh
cd deploy
PRODUCTION_ENV_FILE=./production.env docker compose --env-file production.env --profile tools -f compose.production.yaml run --rm migrate
PRODUCTION_ENV_FILE=./production.env docker compose --env-file production.env -f compose.production.yaml up -d --build web worker backup
```

The web container listens on `127.0.0.1:3000`. Put `deploy/Caddyfile.example` (or an equivalent configuration) in front of it so the OIDC callback and all authenticated traffic use HTTPS. Do not enable proxy access logs that could capture OAuth callback query parameters.

After the deployment, verify the probes and inspect the service state:

```sh
curl -fsS https://mills.example.com/api/health/live
curl -fsS https://mills.example.com/api/health/ready
docker compose --env-file production.env -f compose.production.yaml ps
docker compose --env-file production.env -f compose.production.yaml logs --tail=100 web worker backup
```

## Health probes and worker heartbeat

### Liveness

`GET /api/health/live` is a process probe. It returns HTTP 200 with `{"status":"alive"}` and does not require the database or worker.

### Readiness

`GET /api/health/ready` returns HTTP 200 with `{"status":"ready"}` only when:

1. Configuration is valid.
2. PostgreSQL accepts a query.
3. A Mills worker heartbeat has succeeded recently.
4. The worker has fewer than three consecutive failures.

It returns HTTP 503 with `{"status":"not_ready"}` otherwise. A 503 is an operational signal, not a reason to reset data.

The worker writes a `worker_heartbeat` row for the `mills` loop approximately every three seconds. It records `RUNNING`, `OK`, or `ERROR`, the failure count, the last successful heartbeat, and the update time. Readiness considers a successful heartbeat older than 180 seconds stale.

### Prometheus metrics

`GET /api/metrics` requires the monitoring bearer token:

```sh
curl -fsS \
  -H "Authorization: Bearer $MONITORING_TOKEN" \
  https://mills.example.com/api/metrics
```

An invalid or missing token returns HTTP 401. The response contains aggregate metrics only, including `mills_ready`, `mills_worker_healthy`, `mills_active_jobs`, `mills_attention_trades`, `mills_pending_messages`, `mills_recent_audits`, and `mills_backup_fresh`. It contains no contact names, email addresses, phone numbers, message bodies, or OAuth data.

The alert rules in `deploy/alerts.yml` cover metrics availability, worker health, stale backups, and trades that need attention. Connect them to your existing Alertmanager receiver.

## Backups

Backups use `pg_dump --format=custom`, AES-256-GCM encryption, and a 64-character hexadecimal key. The encrypted file is written with restrictive permissions and a SHA-256 checksum. Authentication/session state, OAuth state, throttles, and worker heartbeats are intentionally excluded so a restore cannot resurrect active sessions.

### Create a backup manually

Ensure `BACKUP_ENCRYPTION_KEY`, `DATABASE_URL`, and PostgreSQL client tools are configured:

```sh
npm run backup:create
```

The command prints JSON containing the encrypted path, byte count, and checksum. Keep the encrypted file and the key in separate protected stores. The production `backup` service runs this loop daily and writes to the `/backups` volume.

### Restore safely

Always restore to a separate empty database whose name ends in `_restore`. Never restore over the source database. Set `RESTORE_DATABASE_URL` to that target and pass the exact database name as the confirmation argument:

```sh
export RESTORE_DATABASE_URL='postgresql://restore_user:REDACTED@database.example.com:5432/mills_restore?sslmode=verify-full'
npm run backup:restore -- /secure/backups/mills-2026-01-01.enc mills_restore
```

The restore command refuses a non-empty target, a target that matches `DATABASE_URL`, or a confirmation that does not end in `_restore`. It clears transient auth, OAuth, throttle, and heartbeat tables after restoring. Treat the result as `reviewRequired: true`: verify schema, account data, job data, audit history, and the health probes before any production cutover.

The MVP does not replicate backups off-site. Configure encrypted volume snapshots or another protected copy outside this repository before relying on the deployment for important customer data.

## Session revocation

Use the UI sign-out for an individual browser session. For an emergency, revoke all sessions and record the administrator event:

```sh
npm run ops:revoke-sessions -- --all
```

The command deletes every row from `auth_session` and writes a `SESSIONS_REVOKED` event. Restart the web and worker services if you are also rotating credentials. OIDC actor-specific revocation accepts only the audited actor ID format `oidc:<32 lowercase hexadecimal characters>`; do not substitute an email address.

## Incident response

### Readiness is failing

1. Check `/api/health/live` to distinguish a process failure from a dependency failure.
2. Check `/api/health/ready` and the `configurationErrors` value from server-side logs or the preflight command.
3. Check PostgreSQL connectivity and TLS settings.
4. Check worker logs and `mills_worker_healthy`.
5. Restart only the unhealthy service after preserving logs. Do not reset or truncate the database.

### Worker heartbeat is stale

Inspect the worker logs and configuration, then restart the worker:

```sh
docker compose --env-file production.env -f compose.production.yaml logs --tail=200 worker
docker compose --env-file production.env -f compose.production.yaml restart worker
```

Confirm `/api/health/ready` returns 200 and the heartbeat metric returns to 1. Repeated failures usually indicate database connectivity, an invalid production environment, or a migration that has not run.

### Backups are stale or failing

Check the backup service logs, free disk space, PostgreSQL client availability, and the backup key. Run `npm run backup:create` manually and verify the returned checksum. Do not delete old backups until a fresh encrypted backup has been validated.

### Suspected credential compromise

1. Revoke all sessions with `npm run ops:revoke-sessions -- --all`.
2. Rotate the OIDC client secret, monitoring token, and backup key in the secret store.
3. Run `npm run ops:preflight -- --production`.
4. Restart web, worker, and backup services.
5. Verify the liveness, readiness, and metrics endpoints with the new credentials.

### Suspected data corruption

Stop writes only if necessary, preserve logs and the current database, and restore the latest known-good backup into a new `_restore` database. Compare the restored records and audit history before planning a controlled cutover. Do not run a destructive migration reset.

## Release checklist

Before declaring a release healthy:

```sh
npm run db:migrate
npm run typecheck
npm test
npm run build
npm run test:e2e
npm run ops:preflight -- --production
```

Then verify:

- `/api/health/live` and `/api/health/ready` return 200.
- The worker heartbeat is healthy.
- A fresh encrypted backup exists and `mills_backup_fresh` is 1.
- OIDC sign-in works for an approved subject only.
- Contractor responses remain trade-scoped.
- Mock sends still require explicit approval and remain `SENT_MOCK`.
- No email, SMS, LinkedIn message, or social post was sent during testing.
