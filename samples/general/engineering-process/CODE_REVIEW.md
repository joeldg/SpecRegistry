# Code Review

## Scope

This specification defines what reviewers must check, how approvals and rejections are recorded, turnaround expectations, and the boundary between automated and human review. It applies to all pull requests merging to a protected branch.

## Intent

Code review is a quality gate and a knowledge-transfer mechanism. It exists to catch defects, maintain architectural coherence, and ensure that every change is understood by at least one person other than its author.

## Reviewer Responsibilities

A reviewer must check all of the following before approving:

| Area | What to verify |
| --- | --- |
| Correctness | The change does what the ticket describes and does not introduce obvious bugs |
| Spec alignment | The implementation matches the governing specification |
| Test coverage | Tests exist for the changed behavior and would fail without the change |
| Security | No credentials committed, no new injection vectors, no auth bypass |
| Backwards compatibility | Public APIs, schemas, and CLI commands are not silently broken |
| Readability | The code is understandable to a future maintainer without the author present |
| Scope | The PR contains only what the ticket describes — no hidden refactors or unrelated fixes |

## Approval Requirements

| Protected branch | Minimum approvals | Notes |
| --- | --- | --- |
| `main` | <!-- 1 --> | At least one human, never the author |
| `release/*` | <!-- 2 --> | One must be a senior engineer or tech lead |
| `develop` | <!-- 1 --> | |

Approvals from automated bots do not count toward the minimum. Authors may not approve their own PR.

## Rationale Requirement

Every approval and every rejection must include a brief written rationale. A silent thumbs-up is not acceptable. The rationale becomes part of the audit trail for why a change was accepted.

Rejection rationale must be specific enough for the author to address it without a follow-up conversation.

## Turnaround SLA

| Priority | First review response | Resolution |
| --- | --- | --- |
| Hotfix / P0 | <!-- 2 hours --> | <!-- Same day --> |
| Standard | <!-- 1 business day --> | <!-- 3 business days --> |
| Chore / dependency bump | <!-- 2 business days --> | <!-- 5 business days --> |

Stale PRs that exceed the resolution SLA without activity are escalated to the tech lead.

## Automated vs Human Review

Automated checks (CI, linting, static analysis, test suites) run first and are a prerequisite for human review eligibility. A PR with failing checks must not be reviewed or approved.

Human reviewers verify judgment-dependent concerns that automated tools cannot catch: architecture fit, spec alignment, and behavioral correctness. Automated checks are not a substitute for human review.

## Review Etiquette

- Comments are about the code, not the author.
- Use blocking comments for genuine blockers; use non-blocking notes for suggestions.
- Resolve your own blocking comments once satisfied — do not leave the author to close them.
- If a comment thread requires more than three exchanges, move the conversation offline.

## Acceptance Evidence

- No PR merged to a protected branch without the required approval count.
- Every approval has an associated rationale comment.
- CI must pass before merge is allowed (branch protection rule).
- Rejection comments are specific and actionable.

## Token Budget Class

Workflow rule. Load for PR review and code quality tasks.

## Related Specs

- `BRANCHING_STRATEGY.md` — PR merge policy and branch requirements.
- `TEST_STRATEGY.md` — what test coverage is required before review.
- `CHANGE_MANAGEMENT.md` — additional gates for high-risk changes.

## AI Agent Directives

Do not approve your own PRs. Always provide a written rationale when approving or requesting changes. Do not merge a PR with failing CI. Flag security concerns and spec misalignments as blocking comments, not suggestions.
