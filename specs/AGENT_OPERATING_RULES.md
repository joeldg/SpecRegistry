# Agent Operating Rules

## Scope

This specification applies to AI agents and automated tools working in repositories
governed by SpecRegistry.

## Intent

Agents must use current, reviewed context; preserve authorization and review boundaries;
produce verifiable evidence; and report missing or contradictory guidance instead of
silently guessing.

## Requirements

1. Before implementation, an agent must load the governed specs for the applicable project
   type and concrete repository through MCP or a verified generated context file.
2. The agent must call `get_specs` or `begin_task` before governed work and use
   `search_specs` or `resolve_guidance` when the initial context does not answer a focused
   question.
3. Concrete repositories must supply `SPECREG_REPO` so project-scoped guidance is loaded in
   addition to global and project-type specs.
4. Auth-required registry clients use `SPECREG_TOKEN` or an explicit bearer token. Agents
   must not print, commit, or copy token values into reports, specs, or generated context.
5. Drift, invalid bundle signatures, and local governed-file hash mismatches are blockers
   until synchronized or explicitly resolved through the governance workflow.
6. Ambiguity, contradiction, outdated guidance, missing intent, and missing coverage must
   be reported with `report_spec_feedback` or the equivalent agent API.
7. Agents must not bypass review, approval policy, separation of duties, RBAC, repository
   scope, audit logging, or protected-branch controls.
8. Completion claims must include the relevant spec mapping, actual build/test/check
   outcomes, failed or skipped checks, assumptions, and residual risks.
9. When compliance or traceability gates apply, the agent must run them and must not convert
   a failed result into a successful completion claim.
10. Skills and generated guidance structure a workflow but do not grant tool permission or
    override published specifications.

## Non-Goals

- Requiring agents to load every reference spec into every prompt.
- Granting production, deployment, merge, or secret access.
- Allowing locally inferred conventions to replace missing governed guidance.

## Acceptance Evidence

- Agent sessions or context events show the governing specs loaded for the repository.
- Feedback records capture unresolved ambiguity, contradiction, staleness, or gaps.
- Change summaries cite relevant specs and include observed verification results.
- Auth-required MCP/CLI configuration uses token indirection without exposing token values.
- Compliance and trace reports identify drift and unmapped implementation surfaces.

## Token Budget Class

Global invariant. Load by default because it controls how agents acquire and apply all other
governed context.

## Related Specs

- `SDD_OPERATING_MODEL.md`
- `IMPLEMENTATION_EVIDENCE.md`
- `SECURITY_AND_SECRETS.md`
- `TRACEABILITY_AND_OBSERVABILITY.md`

## AI Agent Directives

Load current governed context before changing implementation. Search when focused guidance
is missing. Report uncertainty rather than inventing policy. Preserve human approval and
host authorization boundaries, and finish with concrete evidence instead of unsupported
assurance.
