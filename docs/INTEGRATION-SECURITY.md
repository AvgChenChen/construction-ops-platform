# Integration security boundary

Live integrations are not enabled in the Mills MVP.

Before enabling Gmail, Outlook, Google Sheets, payments, or model providers:

- Request the minimum provider scopes.
- Store refresh tokens encrypted and never log them.
- Provide explicit connect, disconnect, and revoke actions.
- Scope every provider account to one Mills account.
- Verify webhook signatures before parsing provider events.
- Reject stale or replayed webhook requests.
- Make event handling idempotent.
- Store provider IDs, not raw payloads, unless the payload is required for a documented feature.
- Redact message bodies, resume data, and contact details from telemetry.
- Require human approval before any external send or submission.
- Keep mock adapters and provider-contract tests as the default test path.

Provider configuration is incomplete until OAuth consent, redirect URIs, scopes, privacy terms, and incident-response ownership are documented.
