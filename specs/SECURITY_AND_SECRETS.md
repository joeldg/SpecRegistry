# Security and Secrets

## Scope
This specification applies to credentials, API keys, registry tokens, LDAP bind settings, webhook secrets, local LLM endpoints, hosted LLM providers, Docker deployments, and generated agent configuration.

## Intent
SpecRegistry must let agents and humans work with governed context without leaking credentials or confusing local development settings with deployable server settings.

## Requirements
1. Secrets must never be committed to source control, generated specs, compiled agent context, screenshots, logs, or code trace reports.
2. Auth-required registries must use `SPECREG_TOKEN` or explicit bearer tokens for CLI and MCP clients.
3. Generated MCP and agent pack content must use `SPECREG_PUBLIC_URL` or the externally reachable registry URL, not an unreachable bind address.
4. API keys configured in the UI must be obfuscated when displayed after save.
5. LDAP bind passwords, webhook secrets, LLM API keys, and app integration secrets must be treated as sensitive settings.
6. Local or network LLM endpoints must be explicit and must not silently send sensitive code/specs to unintended providers.
7. Docker deployments must document hostname, port, public URL, auth mode, token path, and persistent database volume.
8. Security contradictions must be reported as spec feedback before implementation proceeds.

## Non-Goals
This spec does not replace organization-specific security policy, threat modeling, or compliance requirements.

## Acceptance Evidence
- README/deployment docs show `SPECREG_PUBLIC_URL`, `SPECREG_AUTH`, and `SPECREG_TOKEN` paths.
- Saved secrets display only presence/obfuscated state.
- Agent-generated files do not contain raw tokens or keys.
- Security feedback is filed when global and project guidance conflict.

## Token Budget Class
Global invariant. Load by default because accidental secret leakage and auth drift are high-impact failures.

## Related Specs
- `AGENT_OPERATING_RULES.md`
- `SDD_OPERATING_MODEL.md`
- `IMPLEMENTATION_EVIDENCE.md`

## AI Agent Directives
Refuse to print, persist, or invent secrets. When configuring MCP, CLI, LLM, LDAP, Docker, or webhook behavior, preserve token indirection and call out missing auth or public URL settings.
