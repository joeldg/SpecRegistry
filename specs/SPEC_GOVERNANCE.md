# Spec Governance

## Scope
This specification applies to review, approval, publication, promotion, deletion, and downstream synchronization of governed specs.

## Intent
SpecRegistry must make rule changes deliberate, reviewable, versioned, and explainable. A spec is source-of-truth only after it passes governance.

## Requirements
1. Draft specs may be edited directly until submitted for review or published.
2. Published specs must change through change requests, not direct mutation.
3. Semver deltas must match impact: major for breaking or removed guidance, minor for new compatible guidance, patch for clarifications.
4. Reviewers must inspect diff, compatibility, contradiction findings, impact analysis, required approvals, and migration checklist before publication.
5. Project-scoped specs may override only the attached repository and must not silently change a project type's shared baseline.
6. Global specs apply to every project type unless a reviewed project-type or project-scoped spec explicitly narrows the rule.
7. Deletions must preserve audit history and must not be treated as proof that old implementations were compliant.
8. Webhooks, sync jobs, and downstream PRs must carry enough summary context for consumers to verify the change.
9. Project types must represent reusable baselines for a family of similar repositories, not one-off product instances.
10. Product-specific behavior, local deployment choices, repo-only API contracts, and implementation constraints must be captured as project-scoped specs attached to the concrete repository.
11. When a project-type spec starts to describe only one repository, reviewers should split the reusable baseline guidance from the project-specific guidance before publication.

## Non-Goals
This spec does not define individual reviewer identities or approval counts. Approval policies define those details.

## Acceptance Evidence
- Published changes have change request records, approvals, semver delta, and audit log entries.
- Publish preview identifies affected consumers, dependencies, feedback, usage, and migration steps.
- Project-scoped specs appear in reports as project-specific, not project-type-wide.

## Token Budget Class
Workflow rule. Load for spec review, approval, publishing, and migration tasks.

## Related Specs
- `SDD_OPERATING_MODEL.md`
- `SPEC_AUTHORING_STANDARD.md`
- `IMPLEMENTATION_EVIDENCE.md`

## AI Agent Directives
Do not bypass the registry workflow. When a requested spec edit affects published guidance, submit a review or draft according to the existing lifecycle instead of overwriting governed files.
