# Authorization Model

## Scope

This specification defines the roles, permissions, resource scopes, and privilege escalation rules for this system. It applies to every endpoint, action, and resource that enforces access control.

## Intent

Authorization determines what an authenticated identity may do. Inconsistent authorization — enforced in some places and missing in others, or implemented per-handler instead of centrally — creates vulnerabilities that are hard to audit and easy to miss. This spec ensures authorization is uniform, centrally enforced, and reviewable.

## Model Type

This system uses: <!-- RBAC (Role-Based Access Control) | ABAC (Attribute-Based) | ACL (Access Control List) -->

For RBAC, roles are predefined and assigned to users. For ABAC, policies evaluate attributes of the subject, resource, and environment at request time. Record the chosen model here and do not mix approaches without a reviewed ADR.

## Roles

| Role | Description | Who holds it |
| --- | --- | --- |
| `admin` | Full system access including user management and configuration | System administrators |
| `editor` | Can create and modify resources; cannot manage users or system settings | Power users, service accounts |
| `viewer` | Read-only access to resources | Analysts, auditors, external integrations |
| `agent` | Machine identity; scoped to specific resources | CI/CD, automation agents |

Add or rename roles to match your system. Every role must have a documented description and a clear statement of who holds it.

## Permissions Matrix

| Action | admin | editor | viewer | agent |
| --- | --- | --- | --- | --- |
| Read resources | ✓ | ✓ | ✓ | scoped |
| Create resources | ✓ | ✓ | — | scoped |
| Update resources | ✓ | ✓ | — | scoped |
| Delete resources | ✓ | — | — | — |
| Manage users | ✓ | — | — | — |
| View audit log | ✓ | — | — | — |
| Manage system settings | ✓ | — | — | — |
| Approve / publish | ✓ | review required | — | — |

"scoped" means access is limited to the specific resources the agent identity is enrolled for.

## Enforcement Rules

1. Authorization is enforced at the middleware layer, not inside individual handlers.
2. Default deny: if a role is not explicitly listed as permitted for an action, it is denied.
3. Users may not elevate their own permissions.
4. Service accounts and agents may not approve their own submissions.
5. Audit log entries must be written for every privilege escalation and every denied access attempt.

## Resource Scoping

Some roles have scoped access — they may act only on resources they own or are explicitly assigned to. Scoping is enforced by:

- Filtering query results to owned resources before returning them
- Rejecting write operations on resources outside the scope
- Never relying on client-provided scope claims without server-side verification

## Privilege Escalation

Privilege escalation (temporarily acting with higher permissions) is:

- <!-- Not supported | Supported with the following controls: -->
  - Explicit request to `<!-- /auth/elevate -->` with reason
  - Approved by a user who already holds the target role
  - Time-limited to <!-- 15 minutes -->
  - Audit-logged with the requester, approver, reason, and duration

## Acceptance Evidence

- Authorization middleware runs on every protected route (verified by integration tests).
- Default-deny behavior tested: unauthenticated and wrong-role requests return 403.
- Agents cannot approve or publish their own submissions (verified by test).
- Every denied access attempt appears in the audit log.

## Token Budget Class

Project contract. Load for authorization design, middleware review, and access control tasks.

## Related Specs

- `AUTHENTICATION_FLOWS.md` — how identities are established before authorization.
- `LOGGING_STANDARD.md` — audit log requirements for access control events.
- `API_CONTRACT.md` — 401 and 403 response shapes.

## AI Agent Directives

Enforce authorization at the middleware layer, never inside individual handlers. Apply default-deny: any role not explicitly listed as permitted is denied. Do not generate code that allows a user or agent to elevate its own permissions or approve its own submissions. Add integration tests for denied-access paths, not just happy paths.
