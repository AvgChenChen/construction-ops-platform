# Mills security testing

Every command below runs locally or in CI against systems Mills owns. **Never point a scanner at a site or system that Mills does not own or has not been given written permission to test.**

## Commands

| Command | What it checks | Needs |
| --- | --- | --- |
| `npm run typecheck` | TypeScript types | — |
| `npm test` | Unit + PostgreSQL integration tests, including `tests/security-hardening.test.ts`, `tests/auth-session.test.ts`, `tests/ai-safety.test.ts`, `tests/mills-service.test.ts` (tenant isolation) | `TEST_DATABASE_URL` ending in `_test` (`npm run db:local`) |
| `npm run build` | Production build | — |
| `npm run test:e2e` | Playwright browser tests (headless), mock-only flows | App on `APP_ORIGIN` and `npm run worker` running |
| `npm run ops:preflight` | Configuration (production requires OIDC, verified DB TLS, monitoring token, backup key) | env |
| `npm run security:audit` | `npm audit --audit-level=high` | network |
| `npm run security:osv` | OSV-Scanner against `package-lock.json` | `osv-scanner` installed; skipped with a message otherwise |
| `npm run security:secrets` | Gitleaks over git history (values redacted in output) | `gitleaks` installed; skipped otherwise |
| `npm run security:zap` | OWASP ZAP baseline (passive) scan | Docker; `ZAP_TARGET_URL` must be local (`127.0.0.1`, `localhost`, `host.docker.internal`) or a `staging.` host. Anything else is refused. |
| `npm run security:check` | typecheck + tests + audit + OSV + secrets | DB for tests |

## CI

- `.github/workflows/ci.yml` — migrate, typecheck, tests, build, Playwright, Docker build.
- `.github/workflows/security.yml` — `npm audit`, typecheck, tests, build; OSV-Scanner (`google/osv-scanner-action@v2.7.0`); Gitleaks (`gitleaks/gitleaks-action@v3.0.0`).

## What the security tests cover

| Area | Tests |
| --- | --- |
| Auth | wrong password, login throttling, absolute and idle expiry, revocation, malformed tokens, OIDC issuer + subject allowlist (including removal from the allowlist), open redirects, cookie flags, auth audit events without secrets |
| Authorization | cross-account reads/writes, contractor least privilege, operator role, cross-account trade membership (`mills-service.test.ts`) |
| Web | oversized and malformed bodies, SQL/script payloads stay data, no raw-HTML rendering in `src/`, CSP/frame/nosniff headers, HSTS absent outside HTTPS production |
| Uploads | magic-byte vs extension vs MIME spoofing, filename normalization, path traversal, quarantine until scanned, expiring tenant-bound download links, attachment-only headers |
| Webhooks | valid, bad signature, missing secret, expired, wrong account, malformed, replayed |
| AI | approval bypass, outbound/unknown tools, injected override text, link exfiltration, cross-tenant scope/evidence, unsupported claims, contact data in drafts, extra fields, log redaction |
| Operations | metrics bearer auth, heartbeat health + aggregate-only metrics, restore refuses non-`_restore` or same-as-source targets, tampered backup rejected |

Not automated: a real `pg_dump`/`pg_restore` round trip (run the restore drill in `MILLS-OPERATIONS.md` and it will show in `mills_restore_drill_age_seconds`), and ZAP (manual, opt-in).
