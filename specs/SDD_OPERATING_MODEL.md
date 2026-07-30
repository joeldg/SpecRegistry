# SDD Operating Model

## Scope
This specification applies to every repository, project type, global spec, project-scoped spec, and agent workflow governed by SpecRegistry.

## Intent
Spec Driven Development succeeds only when implementation work is traceable to current, reviewed, measurable specifications. The registry is the control plane for that loop, not a passive document store.

## Requirements
1. Every governed repository must initialize through `specreg init` or an equivalent reviewed automation path.
2. Every implementation task must identify the current governed spec set before code, configuration, tests, or generated artifacts are changed.
3. Local governed specs must come from the registry bundle and manifest, not from hand-edited local files.
4. Drift reported by `specreg check` is a blocking SDD failure until synchronized, explicitly waived, or resolved by reviewed spec changes.
5. Generated draft specs must remain outside the governed `specs/` directory until submitted through the registry workflow.
6. Ambiguity, contradiction, outdated guidance, or missing coverage must be reported as spec feedback instead of guessed around.
7. Spec changes must use review, approval policy, semver classification, audit log, and publish workflow before they become active guidance.

## Non-Goals
This spec does not define technology-specific architecture, coding style, or runtime behavior. Project-type and project-scoped specs define those contracts.

## Acceptance Evidence
- A repository contains `specs/.specregistry.json` from the registry.
- CI runs `specreg check` and fails on manifest, signature, or version drift.
- Review summaries cite affected specs or state that a gap was reported.
- Generated drafts appear under `.spec/drafts` or the registry draft workflow, not as direct edits to governed specs.

## Token Budget Class
Global invariant. Keep loaded by default for agents because it defines how all other specs are trusted.

## Related Specs
- `AGENT_OPERATING_RULES.md`
- `SPEC_GOVERNANCE.md`
- `TRACEABILITY_AND_OBSERVABILITY.md`

## AI Agent Directives
Before implementation, load governed specs through MCP or generated context. If drift is detected, stop and ask for synchronization. If a required spec is missing or contradictory, file feedback and do not invent the missing rule.
