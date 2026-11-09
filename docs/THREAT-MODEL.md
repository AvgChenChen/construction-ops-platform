# Mills threat model

## Assets

- Contractor contact details, job schedules and discovery contacts.
- Account membership and trade-scoped access.
- Draft messages and approval records (the approval gate itself).
- Session tokens, OIDC state, monitoring token, backup key.
- Encrypted backups.

## Threats and controls

| Threat | Control | Verification |
| --- | --- | --- |
| Cross-account data access | Account/job/trade checks in server services; composite membership keys | `mills-service.test.ts` |
| Session theft / fixation | Random 256-bit tokens, hashed at rest; HttpOnly, SameSite, Secure on HTTPS; 8 h cap, 30 min idle; revocation | `auth-session.test.ts`, cookie tests |
| Credential stuffing | PostgreSQL throttle on login and OIDC start; failure audit + metric | `auth-session.test.ts` |
| CSRF | Exact Origin check on all POSTs + SameSite | route code, `validOrigin` |
| Open redirect | Internal-path validation | `auth.test.ts`, `security-hardening.test.ts` |
| XSS | React escaping, no raw HTML (tested), CSP, nosniff; downloads served as sandboxed attachments | `security-hardening.test.ts` |
| Clickjacking | `frame-ancestors 'none'`, `X-Frame-Options: DENY` | header test |
| Request flooding / large bodies | Body caps, per-actor throttles | `security-hardening.test.ts` |
| SQL injection | Parameterized queries, Zod UUIDs | payload tests |
| Malicious uploads | Magic bytes + extension + MIME, random storage keys, traversal guard, quarantine until scanned, no inline rendering | upload tests |
| Webhook spoofing / replay | HMAC over timestamp + raw body before parsing, freshness, account scope, event-id dedup | webhook tests |
| AI prompt injection / exfiltration / approval bypass | Strict result schema, tool allowlist, outbound tools blocked, override text and links rejected, `PENDING_HUMAN_APPROVAL` only | `ai-safety.test.ts` |
| Sensitive data in logs | `redactLogDetail`, event-only logging | redaction tests |
| Destructive restore | Empty, separately named `_restore` target; refuses source DB | restore tests |
| Leaked secrets in git | Gitleaks in CI | `security.yml` |
| Vulnerable dependencies | npm audit, OSV-Scanner | `security.yml` |

## Trust boundaries

1. Browser → Next.js route handlers (Origin, session, body cap, Zod).
2. Route handlers → PostgreSQL (parameterized, account-scoped).
3. Future provider webhooks → integration routes (`verifyWebhook`).
4. Future model output → `guardWorkerResult` → human approval.
5. Human approval → any outbound action (none enabled).

No boundary may bypass the approval policy or tenant authorization.

## Known gaps

`'unsafe-inline'` in `script-src`; in-memory replay guard; single `local-operator` identity in local mode; no self-serve export/delete.
