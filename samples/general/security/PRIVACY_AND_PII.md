# Privacy and PII

## Scope

This specification defines what constitutes personally identifiable information (PII) in this system, the minimization requirements, the consent model, data subject rights, and the breach notification procedure. It applies to every feature, service, and data store that collects, processes, or retains information about individuals.

## Intent

Privacy is a fundamental right. Collecting more data than necessary, retaining it longer than needed, or failing to protect it creates legal liability and erodes user trust. This spec ensures that PII handling is deliberate, minimal, and respectful of individual rights.

## PII Inventory

List every category of personal data this system collects or processes:

| Category | Examples | Collected? | Purpose | Retention |
| --- | --- | --- | --- | --- |
| Contact information | Email, phone, address | <!-- Yes/No --> | <!-- e.g. account login, notifications --> | <!-- e.g. duration of account + 30 days --> |
| Identity | Name, username, profile photo | <!-- Yes/No --> | <!-- --> | <!-- --> |
| Financial | Payment method, billing address | <!-- Yes/No --> | <!-- --> | <!-- --> |
| Usage data | IP address, device ID, session logs | <!-- Yes/No --> | <!-- --> | <!-- --> |
| Location | GPS coordinates, city/country | <!-- Yes/No --> | <!-- --> | <!-- --> |
| Sensitive | Health, political views, biometrics | <!-- No --> | <!-- Avoid unless essential --> | <!-- --> |

Sensitive PII requires a privacy impact assessment and explicit legal basis before collection.

## Data Minimization

Collect only the data required to fulfill the stated purpose. Before adding a new data field, confirm:

1. What is the specific purpose that requires this field?
2. Could the purpose be fulfilled with less-specific or anonymized data?
3. Is the retention period tied to the purpose, not to a vague "may be useful later" rationale?

## Consent Model

| Mechanism | When required |
| --- | --- |
| Explicit opt-in | Collecting sensitive PII; marketing communications; selling or sharing data |
| Terms of service acceptance | Collecting data necessary to provide the service (legitimate interest basis) |
| No consent required | Anonymized / aggregated data with no re-identification risk |

Consent records must be stored: who consented, to what, when, and which version of the privacy policy was in effect.

## Data Subject Rights

Users have the following rights, which must be fulfillable within <!-- 30 days --> of a request:

| Right | What this system must support |
| --- | --- |
| Access | Provide a complete export of all PII held about the individual |
| Rectification | Allow users to correct inaccurate data |
| Erasure ("right to be forgotten") | Delete or anonymize all PII, including backups, within the retention window |
| Portability | Provide data in a machine-readable format (JSON or CSV) |
| Restriction | Pause processing for a user while a dispute is resolved |
| Objection | Allow users to opt out of processing for marketing or profiling |

Requests are logged with the requester, the right exercised, the date received, and the date fulfilled.

## Breach Notification

If a data breach is confirmed or reasonably suspected:

1. Notify the security team and legal within <!-- 1 hour --> of discovery.
2. Assess scope: which individuals are affected, what data categories, what risk of harm.
3. Notify the relevant supervisory authority within <!-- 72 hours --> if required by applicable law (e.g. GDPR).
4. Notify affected individuals without undue delay if the breach poses a high risk to their rights and freedoms.
5. Document the breach: timeline, scope, cause, remediation steps, and notifications sent.

## Acceptance Evidence

- PII inventory is complete and up to date when new data fields are introduced.
- Data subject access and erasure requests can be fulfilled within the defined SLA.
- Consent records are stored with the required fields.
- A breach notification procedure is tested at least annually (tabletop exercise or actual drill).

## Token Budget Class

Project contract. Load for data collection design, privacy impact assessment, and compliance tasks.

## Related Specs

- `DATA_CLASSIFICATION.md` — sensitivity tiers and retention limits.
- `DATA_MODEL.md` — where PII fields live in the schema.
- `SECRETS_MANAGEMENT.md` — credentials and tokens distinct from PII but equally sensitive.

## AI Agent Directives

Before generating code that collects a new data field, verify the purpose and minimization justification against this spec. Do not collect sensitive PII (health, biometrics, political views) without explicit human approval and a documented legal basis. Flag any new data field that appears in this inventory without a documented retention period as a compliance gap requiring human review.
