# Mills observability

Mills uses the smallest setup that answers "is it up, is it safe, is anything stuck": Prometheus-format metrics from the database plus redacted JSON logs. **No Sentry or OpenTelemetry SDK is installed.** No telemetry leaves the server unless someone configures a scraper.

## Endpoints

| Endpoint | Auth | Content |
| --- | --- | --- |
| `GET /api/health/live` | none | `{"status":"alive"}` |
| `GET /api/health/ready` | none | `ready`/`not_ready` only (DB reachable, config valid, worker heartbeat fresh) |
| `GET /api/metrics` | `Authorization: Bearer $MONITORING_TOKEN` (≥ 32 chars) | aggregate counters below |
| `GET /api/operations` | signed-in operator | same data as JSON for HQ |

## Metrics

| Metric | Meaning |
| --- | --- |
| `mills_ready` | 1 when config is valid and the worker is healthy |
| `mills_worker_healthy{loop}` | heartbeat < 180 s old, has succeeded, < 3 failures |
| `mills_worker_heartbeat_age_seconds{loop}` | seconds since last heartbeat (-1 = never) |
| `mills_worker_consecutive_failures{loop}` | worker failure streak |
| `mills_pending_messages` | **approval queue size** (drafts waiting for a person) |
| `mills_auth_failures_24h` | failed local sign-ins |
| `mills_oidc_failures_24h` | failed OIDC callbacks |
| `mills_backup_fresh` | last backup < 26 h old |
| `mills_backup_failures_24h` | failures recorded by `backup:loop` |
| `mills_restore_drill_age_seconds` | since the last successful `backup:restore` (-1 = never) |
| `mills_active_jobs`, `mills_attention_trades`, `mills_recent_audits` | business health |

Worker task duration: the worker logs `MILLS_WORKER_SLOW_TICK` with `duration_ms` when a tick takes over 1 s. **Queue delay** and **external integration errors** do not apply yet: there is no job queue and no live integration. Add them with the first queue/integration.

Suggested alerts are in `deploy/alerts.yml`.

## Logging rules

- Use `safeLog(event, detail)`. It runs `redactLogDetail`, which removes emails, phone numbers, bearer tokens, JWTs and `password=`/`token=`/`secret=` style values, and truncates to 500 characters.
- Log event names and ids, never message bodies, resumes, email content, contact details, cookies, OAuth codes or provider responses.
- Auth events store only the type and mode.

## Adding Sentry or OpenTelemetry later

Pick **one**. Keep it off unless its env var is set (`SENTRY_DSN` or `OTEL_EXPORTER_OTLP_ENDPOINT`). Before enabling:

1. Turn off default PII (`sendDefaultPii: false`), request bodies, cookies and headers.
2. Run every event/span attribute through `redactLogDetail` in a `beforeSend` / span processor.
3. List the vendor as a subprocessor in the privacy policy.
4. Add a test that a captured error containing an email and phone number is scrubbed.
