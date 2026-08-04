# Secrets Management

## Scope

This specification defines where secrets live, how they are rotated, who may access them, how revocation works, and the patterns that are unconditionally prohibited. It applies to every credential, token, key, certificate, and password used by this system.

## Intent

Secrets committed to source control, logged in plaintext, or shared over unencrypted channels are effectively public. This spec makes secret handling explicit so that every engineer and agent knows the rules before touching a credential.

## Secret Types

| Type | Examples | Storage location |
| --- | --- | --- |
| Service credentials | Database passwords, internal API keys | Secret manager (see below) |
| User-generated tokens | API keys, OAuth tokens | Database, hashed |
| Signing keys | JWT signing keys, HMAC secrets | Secret manager |
| TLS certificates | Service certs, CA certs | Certificate manager |
| Third-party API keys | Payment provider, email, SMS | Secret manager |
| Infrastructure credentials | Cloud provider keys, deployment tokens | Secret manager or CI secret store |

## Approved Storage Locations

| Location | Allowed | Notes |
| --- | --- | --- |
| Secret manager (<!-- AWS Secrets Manager / HashiCorp Vault / GCP Secret Manager -->) | Yes | Preferred for all service credentials |
| CI/CD secret store | Yes | For build and deployment tokens only |
| Environment variables (at runtime) | Yes | Injected at deploy time from the secret manager; not hard-coded |
| Database (hashed) | Yes | For user-generated tokens; store hash, never plaintext |
| `.env` file (local development) | Yes, if gitignored | Must never be committed; `.env.example` with no real values is acceptable |
| Source code | No | Unconditionally prohibited |
| Plain-text config files committed to git | No | Unconditionally prohibited |
| Log output | No | Never log secret values |
| Slack / email / chat | No | Use secure secret sharing (e.g. one-time link) |

## Prohibited Patterns

The following are unconditionally prohibited regardless of context:

- Hard-coded secrets in source code (including test fixtures and example files)
- Secrets in git history (if discovered, rotate immediately and consider history compromised)
- Plaintext secrets in log output or error messages
- Sharing secrets over unencrypted channels
- Using the same secret in multiple environments (production secrets must not be used in staging or development)

## Rotation Policy

| Secret type | Rotation frequency | Trigger for immediate rotation |
| --- | --- | --- |
| Service credentials | <!-- Every 90 days --> | Suspected compromise, personnel change |
| Signing keys | <!-- Every 180 days --> | Suspected compromise |
| TLS certificates | Before expiry (automate with ACME) | Suspected compromise |
| Third-party API keys | <!-- Every 90 days --> | Suspected compromise, vendor notification |
| User-generated tokens | On demand by the user | User request, suspected compromise |

Rotation must be zero-downtime: issue new credentials, deploy, verify, then revoke old credentials.

## Access Control

- Secrets are accessed by services using role-based identities (IAM roles, workload identity), not long-lived shared credentials.
- Access to secrets in the secret manager is logged.
- No human should have routine access to production secrets; access is emergency-only and logged.
- Developers use separate, lower-privilege credentials for local development.

## Emergency Revocation

When a secret is suspected compromised:

1. Rotate the secret immediately (issue a replacement before revoking).
2. Deploy the new secret to all consumers.
3. Revoke the old secret.
4. Audit access logs for evidence of unauthorized use.
5. Open an incident ticket.

Do not wait for confirmation of exploitation before rotating a suspected compromised secret.

## Acceptance Evidence

- No secrets appear in source code, git history, or log output (verified by secret scanner in CI).
- Rotation cadence is enforced by calendar alerts or automated rotation in the secret manager.
- Emergency revocation procedure is tested at least annually.
- Access to production secrets is logged and reviewed quarterly.

## Token Budget Class

Global invariant. Load by default because secret leakage is a high-impact failure in every context.

## Related Specs

- `AUTHENTICATION_FLOWS.md` — how secrets are used in token issuance.
- `DATA_CLASSIFICATION.md` — secrets are Restricted-tier data.
- `VULNERABILITY_MANAGEMENT.md` — rotation when a secret is exposed via a CVE.

## AI Agent Directives

Never generate code that hard-codes a secret value. Never propose storing secrets in source code, log output, or environment variable files that are committed to git. When generating code that requires a secret, always use the secret manager or environment variable injection pattern. If you discover a secret in existing code during review, report it as a critical finding requiring immediate human action.
