# Mills launch readiness

**Mills is not production-ready.** Do not call it production-ready until every gate below is checked with evidence.

Status as of 2026-11-09 (branch `security-hardening-mvp`).

| Gate | Status | Evidence / what's left |
| --- | --- | --- |
| Mock mode verified | ✅ | No email/SMS/provider adapters exist; mock sends are `SENT_MOCK`; e2e "keeps approval-gated mock coordination local" passes |
| Human approvals verified | ✅ | `approved: true` required (`mills-service.test.ts`); UI checkbox (e2e); AI guard forces `PENDING_HUMAN_APPROVAL` |
| No live OAuth credentials present | ✅ | `.env.example` has empty OIDC values; Gitleaks in CI. Production OIDC is still to be configured by the founders |
| No outbound email path enabled | ✅ | No email code path |
| No outbound SMS path enabled | ✅ | No SMS code path |
| Tenant authorization tests passing | ✅ | `npm test` 62/62 |
| Security headers verified | ✅ | Header tests + `curl -I` on a local build. Open: `'unsafe-inline'` in `script-src` |
| Dependency scan passing | ⚠️ | `npm audit --audit-level=high` passes; 4 moderate dev-only `esbuild` advisories via `drizzle-kit`; OSV-Scanner runs in CI (not yet run locally — tool not installed) |
| Backups verified | ❌ | Encryption and restore safeguards are unit-tested; a real backup on production infrastructure has not been made |
| Restore tested | ❌ | Run the restore drill; `mills_restore_drill_age_seconds` must be ≥ 0 |
| Sensitive logs redacted | ✅ | Redaction tests (emails, phones, tokens, passwords) |
| Incident response documented | ❌ | Need a named owner, contact path and first-hour checklist |
| Legal drafts reviewed by a qualified professional | ❌ | Five drafts in `docs/*-DRAFT.md`; entity, governing law and liability terms need a lawyer |

## Verification commands

```sh
npm ci
npm run db:migrate
npm run typecheck
npm test
npm run build
npm run test:e2e
npm run ops:preflight
npm run security:check
```
