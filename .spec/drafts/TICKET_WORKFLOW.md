# Work Item and Ticket Workflow

## Scope

This specification governs the content quality of work items — what information makes a
ticket or task useful for implementation and review. For lifecycle, routing, system of
record (GitHub Issues vs. local `.tasks/`), naming conventions, and agent directives
on task creation and closure, see `TASK_WORKFLOW.md`.

## Useful Work Item Content

For work that benefits from a tracked task, record:

- the desired outcome and why it matters;
- affected repository, subsystem, API, schema, configuration, or operational area;
- applicable specifications and exact sections when known;
- acceptance and verification criteria;
- compatibility and risk considerations;
- rollback or mitigation expectations for material risk;
- required evidence; and
- unresolved questions and assumptions.

The amount of detail is proportional to risk and ambiguity. Small, authorized maintenance
does not require ceremonial fields that add no decision value.

## Readiness

Before implementation, confirm that the objective, scope, authority, and done conditions
are clear enough to act safely. If a required decision would materially change the result,
request clarification. Missing guidance is reported through SpecRegistry rather than
guessed or replaced by a fabricated task.

## Relationship to Pull Requests

Link a PR to its task when one exists. The PR remains responsible for describing the
actual diff, spec mapping, verification outcomes, and residual risk; a task reference does
not replace that evidence.

## Review and Escalation

Repository protection and approval policies determine review and merge. Repeated rejection,
unresolved specification conflict, or unclear authority is escalated to a human owner.

## AI Agent Directives

Do not invent task IDs or claim approval that did not occur. Work from a task opened
through the governed workflow defined in `TASK_WORKFLOW.md`. Preserve enough evidence for
reviewers to understand what changed and why.

## Related Specs

- `TASK_WORKFLOW.md`
- `GIT_FLOW.md`
- `IMPLEMENTATION_EVIDENCE.md`
