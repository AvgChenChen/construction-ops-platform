# Mills Data Retention (DRAFT)

> **DRAFT — NOT LEGAL ADVICE.** This document was written by the Mills team as a starting point and has not been reviewed by a lawyer. It must be reviewed and completed by a qualified legal professional licensed in the relevant jurisdiction(s) before it is published or relied on. Items marked **[LAWYER]** need a legal decision.
>
> Mills is not incorporated. "Mills", "we" and "us" below are placeholders for the legal entity or individuals who will operate the service. **[LAWYER: identify the contracting party, governing law and venue. The founders are in Canada.]**
>
> Contact: millsai.now@gmail.com

This reflects how the current code behaves. Numbers in **bold** are proposals for the founders and a lawyer to confirm.

| Data | Kept while account active | After account closure | How it is removed |
| --- | --- | --- | --- |
| Jobs, trades, tasks, mock messages | Yes | Deleted within **30 days** | Account delete cascades (`ON DELETE CASCADE` on `mills_account`) |
| Discovery contacts | Yes | Deleted within **30 days** | Cascade from account |
| Audit events | **24 months** rolling | Deleted with the account | Cascade from account; rolling purge is **not yet automated** |
| Sessions | 8 hours max, 30 min idle | — | Worker deletes expired rows every few seconds |
| Login state / throttle rows | Minutes | — | Worker cleanup |
| Uploaded files (not enabled yet) | Yes | Deleted within **30 days** | Storage delete + audit event |
| Encrypted backups | Daily, keep **30 days** | Expire naturally within **30 days** | Backup rotation; restored data never reintroduces a closed account without review |
| Application logs | **30 days** | — | Host log rotation; logs contain no message bodies or contact details |

## Export

Customers can request an export by emailing millsai.now@gmail.com. Delivered as CSV/JSON within **30 days**. A self-serve export command is a planned engineering task.

## Deletion requests

Verified deletion requests are handled within **30 days**. Data that must be kept for legal reasons is retained only as long as required. **[LAWYER: legal holds and tax/record-keeping periods.]**

## Backups

Backups are encrypted (AES-256-GCM) and exclude session tables. Deleting an account does not edit existing backups; the data disappears when those backups expire. If a backup is restored, deletions made since that backup are re-applied before the restored database is used. **[FOUNDERS: this re-apply step is a manual runbook item today.]**
