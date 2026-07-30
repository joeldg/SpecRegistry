# Implementation Evidence

## Scope
This specification applies to pull requests, change summaries, audit results, code trace reports, generated specs, and any delivery evidence attached to governed implementation work.

## Intent
Completed work should prove what changed, which specs governed it, what was verified, and what remains uncertain. Evidence prevents plausible but unverified compliance claims.

## Requirements
1. Change summaries must list relevant specs or state that a spec gap was reported.
2. Test, lint, build, audit, and code trace commands must be reported with actual outcomes.
3. Failed or skipped checks must be called out as residual risk, not omitted.
4. Work that changes APIs, schemas, commands, config, security posture, or architecture boundaries must include corresponding spec or feedback evidence.
5. Generated specs and examples must be reviewed separately from implementation evidence.
6. CI annotations should identify drift, unmapped code entities, stale local specs, and audit findings when available.
7. Reviewers must be able to trace acceptance evidence back to specific spec sections or explicit gaps.
8. Git commit messages for implementation work must include compact SpecRegistry compliance evidence: the `SpecRegistry-Compliance:`, `SpecRegistry-Signals:`, and `SpecRegistry-Command:` trailer emitted by `specreg comply`, or equivalent `finish_task` evidence with verdict, objective score, and session id.

## Non-Goals
This spec does not prescribe a single PR template. It defines the minimum evidence required for SDD confidence.

## Acceptance Evidence
- PR/change summaries include commands run and observed results.
- Code trace coverage is uploaded for repositories where `specreg code-map --report` is available.
- Missing or ambiguous specs create feedback items or draft specs rather than hidden assumptions.
- Migration checklists accompany breaking spec changes.

## Token Budget Class
Workflow rule. Load for implementation, review, CI, and audit tasks.

## Related Specs
- `SDD_OPERATING_MODEL.md`
- `TRACEABILITY_AND_OBSERVABILITY.md`
- `SPEC_GOVERNANCE.md`

## AI Agent Directives
Never say a check passed without observed output. Include spec mapping, commands run, failures, skipped checks, and remaining risks in the final work summary.
