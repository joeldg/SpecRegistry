# Data Classification

## Scope

This specification defines data sensitivity tiers, the handling rules that apply at each tier, retention limits, and the disposal procedure for data that has reached end of life. It applies to every data asset — database records, log entries, files, backups, API responses, and messages — owned or processed by this system.

## Intent

Not all data deserves the same protection. Over-protecting everything is expensive and impractical; under-protecting sensitive data creates liability. A clear classification scheme ensures that protection effort is proportionate to actual risk.

## Sensitivity Tiers

| Tier | Label | Description |
| --- | --- | --- |
| 0 | **Public** | Intentionally shareable with anyone; no harm if disclosed |
| 1 | **Internal** | Not secret, but not meant for external audiences |
| 2 | **Confidential** | Sensitive business or user data; disclosure causes harm |
| 3 | **Restricted** | Highest sensitivity; disclosure causes severe harm or legal liability |

When the appropriate tier is unclear, classify upward.

## Handling Rules by Tier

| Rule | Public | Internal | Confidential | Restricted |
| --- | --- | --- | --- | --- |
| Encryption at rest | Optional | Recommended | Required | Required |
| Encryption in transit | Optional | Required | Required | Required |
| Access control | None | Authenticated users | Role-restricted | Need-to-know + MFA |
| Logging | Fine | Fine | Log access events, not values | Log access events only |
| Backup | Standard | Standard | Encrypted backup required | Encrypted, access-controlled backup |
| Third-party sharing | Allowed | Requires NDA | Requires DPA + approval | Prohibited without legal review |

## Data Inventory

Classify every significant data type this service handles:

| Data type | Tier | Notes |
| --- | --- | --- |
| User email addresses | Confidential | PII — see `PRIVACY_AND_PII.md` |
| API tokens / secrets | Restricted | Never logged; stored hashed |
| Audit log entries | Internal | Access-event details are Internal; token values within are Restricted |
| <!-- your data types --> | <!-- tier --> | |

## Retention Limits

| Tier | Default retention | Disposal method |
| --- | --- | --- |
| Public | Indefinite | Standard deletion |
| Internal | <!-- 3 years --> | Standard deletion |
| Confidential | <!-- Per legal/privacy requirements --> | Secure deletion (overwrite or cryptographic erasure) |
| Restricted | <!-- Minimum necessary; defined per data type --> | Cryptographic erasure preferred |

Retention limits for data subject to privacy regulations are governed by `PRIVACY_AND_PII.md` and take precedence over defaults here.

## Disposal Procedure

1. Identify the retention end date for the data type.
2. Obtain sign-off from the data owner that disposal is authorized.
3. Apply the disposal method for the tier (see table above).
4. Record the disposal event: data type, volume, date, method, and authorizing person.
5. Verify that backups and caches are also purged within the defined window.

## Acceptance Evidence

- Every significant data type in the service has a tier assignment in this spec.
- Confidential and Restricted data is encrypted at rest and in transit.
- Retention limits are enforced by an automated job or documented manual procedure.
- Disposal events are logged with the required fields.

## Token Budget Class

Project contract. Load for data handling design, privacy review, and compliance tasks.

## Related Specs

- `PRIVACY_AND_PII.md` — PII-specific handling, consent, and subject rights.
- `SECRETS_MANAGEMENT.md` — Restricted data that is operational credentials.
- `LOGGING_STANDARD.md` — which fields may appear in logs by tier.

## AI Agent Directives

Before generating code that stores, transmits, or processes data, identify the tier of the data involved and apply the handling rules for that tier. Never log Confidential or Restricted field values — log access events only. Flag any proposed third-party data sharing that involves Confidential or Restricted data for human review before implementing.
