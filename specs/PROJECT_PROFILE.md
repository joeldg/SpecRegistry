# Project Profile

## Scope
This specification defines the standard project-scoped profile that `specreg init` drafts for a concrete repository.

## Intent
A repository's profile captures the local choices that make generic project-type guidance specific: product intent, stack, data stores, runtime, deployment, compliance posture, agent skills, and explicit non-goals.
Project types are reusable baselines; projects are concrete repositories. The profile keeps a project from accidentally turning its baseline into a one-off project definition.

## Requirements
1. Every initialized repository should submit a project-scoped `PROJECT_PROFILE.md` draft for review.
2. The profile must identify project type, repository identity, lifecycle stage, users, platforms, languages, frameworks, databases, APIs, infrastructure, tests, observability, security, privacy, and non-goals.
3. The profile is not governed until reviewed and published.
4. Material changes to stack, platform, deployment, data stores, external interfaces, or compliance scope must update the profile through review.
5. Project profile guidance may narrow project-type guidance only for the attached repository and only when explicit.
6. Agents must not invent missing project profile choices; they must report ambiguity or ask for a reviewed profile change.
7. A project type should not be named after a single repository or product unless it is intentionally a reusable family name.
8. Specs that mention repo-specific routes, deployment hosts, credentials, local model catalogs, customers, research goals, or product behavior must be project-scoped unless at least one other project is expected to inherit the same rule.

## Non-Goals
This profile is not a replacement for technical contract specs such as API, database, security, observability, or architecture specs.

## Acceptance Evidence
- `specreg init` creates a structured profile draft.
- The profile is submitted as project-scoped draft or review request.
- Reports show the concrete project as a consumer attached to a project type.
- Agent summaries respect published project-scoped profile constraints.
- Dashboard project pages show inherited global/project-type specs separately from project-scoped specs.

## Token Budget Class
Project contract. Load for the attached repository; do not load for unrelated repositories.

## Related Specs
- `SDD_OPERATING_MODEL.md`
- `SPEC_GOVERNANCE.md`
- `AGENT_OPERATING_RULES.md`

## AI Agent Directives
Treat a published project profile as repository-specific guidance. Treat an unpublished generated profile as draft evidence only. Report conflicts between profile choices and global or project-type specs.
