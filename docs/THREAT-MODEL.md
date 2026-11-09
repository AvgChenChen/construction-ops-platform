# Mills threat model

## Assets

- Contractor contact details and project schedules.
- Account membership and trade-scoped access.
- Draft messages and approval records.
- OIDC session identifiers and provider state.
- Encrypted backups.

## Primary threats

| Threat | Control | Verification |
| --- | --- | --- |
| Cross-account data access | Account/job/trade checks in server-side services | Authorization integration tests |
| Session theft | HttpOnly, SameSite cookies; short inactivity window; revocation | Auth tests and production HTTPS preflight |
| CSRF or cross-site mutation | Exact Origin checks on mutations | Route-handler tests |
| Open redirects | Internal-path validation | Redirect tests |
| XSS | React escaping, CSP, no untrusted HTML rendering | ZAP and browser tests |
| Malicious uploads | Size limits, magic-byte checks, private storage boundary | Upload utility tests |
| Webhook spoofing/replay | HMAC, timestamp freshness, idempotency boundary | Signature tests |
| AI prompt injection | Structured outputs, restricted tools, approval gate | Promptfoo/offline adversarial tests |
| Credential leakage | Environment-only secrets and redacted logs | Secret/dependency scans |
| Destructive recovery mistake | Separate `_restore` database requirement | Restore tests |

## Trust boundaries

1. Browser to Next.js route handlers.
2. Next.js services to PostgreSQL.
3. Future provider webhooks to integration routes.
4. Future model providers to AI worker boundaries.
5. Operator approval to any outbound action.

No boundary may bypass the approval policy or tenant authorization checks.
