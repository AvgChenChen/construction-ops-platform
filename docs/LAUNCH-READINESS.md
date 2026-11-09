# Mills launch readiness

Do not call Mills production-ready until every required gate is complete.

## Required gates

- [x] Mock mode remains enabled.
- [x] Human approval remains required for mock outbound actions.
- [x] No live OAuth credentials are stored in the repository.
- [x] No outbound email or SMS path is enabled in the MVP.
- [x] Server-side tenant and trade authorization exists.
- [x] Mutation Origin checks exist.
- [x] Security headers and CSP are present.
- [x] Sensitive log values are redacted.
- [x] Webhook verification utilities have tests.
- [x] Upload validation utilities have tests.
- [ ] Legal drafts reviewed by qualified counsel.
- [ ] Production OIDC provider configured and tested with approved subjects.
- [ ] Dependency scan passing in CI.
- [ ] Authorized staging ZAP scan completed.
- [ ] Backup restore drill completed and recorded.
- [ ] Incident-response owner and escalation contacts documented.
- [ ] Privacy and retention decisions approved.

## Verification commands

```sh
npm run db:migrate
npm run typecheck
npm test
npm run build
npm run test:e2e
npm run ops:preflight
```
