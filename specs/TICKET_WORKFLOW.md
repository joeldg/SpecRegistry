# Work Item and Ticket Workflow

## Scope

This specification governs issues, tickets, and equivalent work items when a team uses
them. An authorized user request or governed agent task session may also initiate work
without inventing a ticket.

## Useful Work Item Content

For work that benefits from a tracked ticket, record:

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
guessed or replaced by a fabricated ticket.

## Relationship to Pull Requests

Link a PR to its ticket when one exists. The PR remains responsible for describing the
actual diff, spec mapping, verification outcomes, and residual risk; a ticket link does not
replace that evidence.

## Review and Escalation

Repository protection and approval policies determine review and merge. Repeated rejection,
unresolved specification conflict, or unclear authority is escalated to a human owner.

## AI Agent Directives

Do not invent ticket IDs or claim approval that did not occur. Work from an authorized user
request, governed task session, or real ticket, and preserve enough evidence for reviewers
to understand what changed and why.
