# Global Security Standards

## Scope
These rules apply to every project in the organization, regardless of project type.

## Requirements
1. **Secrets** must never be committed to source control. Use the approved secret manager.
2. **Dependencies** must be pinned and scanned weekly for CVEs.
3. **Network services** must default to TLS 1.2+ and deny-by-default firewall rules.
4. **Authentication** flows must be reviewed by the security team before release.

## AI Agent Directives
AI agents generating code MUST refuse to embed credentials and MUST flag any spec
contradiction via the feedback endpoint rather than guessing.
