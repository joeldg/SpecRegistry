# Authentication Flows

## Scope

This specification defines the supported authentication mechanisms, session lifecycle, token storage, refresh policy, and the security review gate required before shipping changes to authentication. It applies to every entry point that issues or validates identity claims.

## Intent

Authentication is the highest-leverage attack surface in any system. Small mistakes — insecure token storage, missing expiry, predictable session IDs — have outsized consequences. This spec ensures that authentication changes are deliberate, reviewed, and consistent with the chosen mechanism.

## Supported Mechanisms

Record which mechanisms are in use. Delete rows that do not apply.

| Mechanism | Used for | Notes |
| --- | --- | --- |
| Username + password | User login | Passwords hashed with <!-- bcrypt / argon2 -->; salt rounds <!-- 12 --> |
| OAuth 2.0 + OIDC | SSO via identity provider | Providers: <!-- list --> |
| API keys | Service-to-service, CLI clients | Scoped to a single repo/service; stored hashed |
| mTLS | Internal service mesh | Certificates managed by <!-- cert-manager / Vault --> |
| Session cookies | Web UI | <!-- HttpOnly, Secure, SameSite=Strict --> |

## Token Lifecycle

| Property | Value |
| --- | --- |
| Access token TTL | <!-- 15 minutes --> |
| Refresh token TTL | <!-- 30 days --> |
| Session cookie TTL | <!-- 24 hours --> |
| API key TTL | <!-- No expiry by default; opt-in expiry supported --> |
| Token format | <!-- JWT (RS256) | opaque random string --> |

## Token Storage Rules

| Location | Allowed | Notes |
| --- | --- | --- |
| `HttpOnly` cookie | Yes | Preferred for browser sessions |
| `localStorage` / `sessionStorage` | No | Accessible to JavaScript; XSS risk |
| In-memory (client-side JS) | Yes | Lost on page refresh; acceptable for short-lived access tokens |
| Database (server-side) | Yes | Store hashed, never plaintext |
| Logs | No | Never log token values |
| Source code / config files | No | Never commit tokens |

## Refresh Flow

1. Client presents a valid refresh token to `POST <!-- /auth/refresh -->`.
2. Server validates the refresh token (signature, expiry, not revoked).
3. Server issues a new access token and optionally rotates the refresh token.
4. Rotated refresh tokens invalidate the previous token immediately (rotation prevents reuse after theft).

## Revocation

| Trigger | Action |
| --- | --- |
| User logout | Revoke the session or refresh token; invalidate server-side session if applicable |
| Password change | Revoke all active refresh tokens and sessions for the user |
| Suspected compromise | Revoke all tokens for the user and require re-authentication |
| API key compromise | Revoke the key and issue a new one |

## Security Review Gate

Changes to any of the following require a security review before merging:

- Authentication middleware or token validation logic
- Token issuance, refresh, or revocation endpoints
- Password hashing configuration
- OAuth / OIDC integration or callback handling
- Session cookie configuration

A security review consists of a code review by someone with security expertise who explicitly signs off in the PR.

## Acceptance Evidence

- Access and refresh token TTLs match the values in this spec.
- No token values appear in logs (verified by log sampling).
- Authentication changes include a security reviewer sign-off in the PR.
- Revocation is verified by attempting to use a revoked token and receiving 401.

## Token Budget Class

Project contract. Load for authentication design, implementation, and security review tasks.

## Related Specs

- `AUTHORIZATION_MODEL.md` — what authenticated users are permitted to do.
- `SECRETS_MANAGEMENT.md` — how API keys and signing secrets are stored and rotated.
- `PRIVACY_AND_PII.md` — user identity data handling and retention.

## AI Agent Directives

Do not implement authentication changes without a human security review. Do not store token values in logs, source code, or localStorage. When generating token handling code, verify the TTL and storage location against this spec before proposing. Flag any deviation from the token storage rules as a security concern requiring human review before proceeding.
