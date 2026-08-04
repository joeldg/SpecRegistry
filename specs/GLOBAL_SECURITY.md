# Global Security Standards

## Scope

These rules apply to every project in the organization, regardless of project type or
technology stack.

## Intent

A minimum security baseline applied uniformly across all repositories reduces the blast
radius of a single compromised project, prevents common credential leakage patterns, and
ensures that authentication changes receive human review before they affect production
systems.

## Requirements

1. **Secrets** must never be committed to source control. Use the approved secret manager
   or environment-variable indirection documented in `SECURITY_AND_SECRETS.md`.
2. **Dependencies** must be pinned to explicit versions and scanned for CVEs at least
   weekly. Unfixed high-severity CVEs are a blocking release concern.
3. **Network services** must default to TLS 1.2 or higher and apply deny-by-default
   firewall rules. Plaintext HTTP is permissible only on loopback interfaces in
   development environments.
4. **Authentication** flows must be reviewed by the security team before release to
   production. Changes to authentication middleware, token handling, or session management
   require a spec update or security review record.
5. **Agent-generated code** must not embed credentials, API keys, connection strings, or
   bearer tokens. Agents must report spec contradictions via the feedback endpoint rather
   than guessing around them.

## Non-Goals

- This spec does not replace organization-specific threat modeling, penetration testing,
  or compliance audits (SOC 2, ISO 27001, etc.).
- This spec does not define project-specific firewall rules, key rotation schedules, or
  incident response procedures. Those belong in project-scoped or operational specs.
- This spec does not govern physical or organizational security controls.

## Acceptance Evidence

- No committed file contains raw credentials, API keys, or bearer tokens.
- Dependency manifests (`package-lock.json`, `Cargo.lock`, etc.) are committed and pinned.
- CVE scan results are recorded in CI or a linked security tool at least weekly.
- Authentication-related change requests include a security review record or reviewer sign-off.
- Agent sessions produce no spec-feedback items caused by credential embedding or auth
  bypass attempts.

## Token Budget Class

Global invariant. Load by default because accidental credential leakage or auth drift
are high-impact failures across every project type.

## Related Specs

- `SECURITY_AND_SECRETS.md` — detailed secrets management and credential handling rules.
- `AGENT_OPERATING_RULES.md` — agent behavior and authorization boundaries.
- `IMPLEMENTATION_EVIDENCE.md` — evidence requirements for completed security changes.

## AI Agent Directives

AI agents generating code MUST refuse to embed credentials and MUST flag any spec
contradiction via the feedback endpoint rather than guessing. When generating
authentication, token handling, or network-service code, verify the change against this
spec and `SECURITY_AND_SECRETS.md` before proceeding.
