# Ticket Creation and Governance Specification

## Purpose

In a Spec-Driven Development model the ticket becomes more important, not less. The ticket
is the entry point for change: it defines the desired outcome, acceptance criteria, affected
systems, expected tests, and the evidence required before the work is complete. An AI agent
may *draft* a ticket, but the organization must *approve* it before any implementation begins.

## Ticket Formatting

A ticket defines an intended outcome, not just a task. Every ticket must include:

| Field | Description |
| --- | --- |
| Change objective | What needs to change and why. |
| Affected system | Repo, service, subsystem, API, protocol, database, or configuration area impacted. |
| Specification references | Links to the relevant system, API, protocol, configuration, database, or testing specifications. |
| Acceptance criteria | Conditions that must be true for the ticket to be considered complete. |
| Verification criteria | Tests, build steps, reviews, simulations, or artifacts required to prove the work. |
| Risk classification | Low, medium, high, or hardware-impacting. |
| Compatibility impact | Whether the change affects APIs, protocols, schemas, configs, or downstream consumers. |
| Rollback expectation | How the change can be reverted or mitigated. |
| Evidence requirements | Logs, test reports, screenshots, build artifacts, simulation reports, or review notes. |
| Open questions | Assumptions or missing details that require human clarification. |

## Quality

A weak ticket creates weak AI output. A vague ticket — missing objective, acceptance, or
verification criteria — lets an agent produce code that looks correct but fails the real
objective. Improve ticket quality by asking an agent "how can you improve this ticket," and
by validating a ticket with more than one model: diversity of thought yields better tickets.

## Minimum Requirements for a Good Ticket

Maintain a guide for engineers, product owners, and managers on asking AI to create tickets:
the required format, examples of vague or unsafe requests, how to describe done conditions,
how to specify validation requirements, how to flag risk, and how to link to specifications.

## Governance

The role of the developer shifts from builder to architect and inspector. Governance tooling
validates that the architecture stays in line with the specification, and requires full code
review with an explicit explanation for every pass or rejection. Dashboards generated at each
step show the actions of the agents. Agents have a bounded retry process to fix issues
themselves; if a ticket's changes are rejected more than the configured number of times, the
agent flags the ticket and PR for human-in-the-loop review.

## AI Agent Directives

An agent must not begin implementation against an unapproved ticket, must populate every
required field (filing open questions rather than guessing), and must attach the verification
evidence the ticket demands before marking work complete.
