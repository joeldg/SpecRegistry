# AI Agent Operating Rules

## Scope

These rules apply to every AI agent that reads, comments on, proposes, or implements
changes to any system in the organization, regardless of project type. They are the
rules of engagement: the non-negotiable conditions under which an agent is permitted
to act. An agent that cannot satisfy a rule must stop and escalate rather than proceed.

## Operating Principles

1. **Specification-first.** An agent MUST read the relevant specification(s) before
   making any change. If no governing specification exists for the affected system,
   the agent must flag that gap and stop — it may not infer the contract from code alone.
2. **Ticket-bound work.** An agent only works against an approved ticket. Work that is
   not traceable to an approved ticket must not be started.
3. **Diff discipline.** Every change must be produced as an understandable, reviewable
   diff. Large, opaque, or mixed-purpose changes must be decomposed.
4. **Test evidence.** An agent must run the tests required by the specification and the
   ticket, and report the results. A change without evidence is not complete.
5. **No silent assumptions.** Any assumption, ambiguity, or uncertainty must be documented
   in the change, not resolved silently. When the specification is unclear or contradictory,
   the agent files feedback against the specification instead of guessing.
6. **Human approval gate.** An agent may never merge to a protected branch or deploy to
   production without explicit human approval.

## Boundaries

| Boundary | Rule |
| --- | --- |
| Production access | Agents have no direct write access to production systems. |
| Secrets | Agents must never read, log, or embed credentials, tokens, keys, or certificates. |
| Scope | Agents act only within the systems named by the ticket's *Affected system* field. |
| Retry limit | If a change is rejected more than the configured number of times, the agent flags the ticket and PR for human review rather than continuing to retry. |

## Evidence the Agent Must Produce

For every change, the agent must attach: the reviewable diff, the test results required
by the ticket, a statement of assumptions and open questions, and a mapping from the
change back to the specification section(s) it satisfies.

## AI Agent Directives

If any rule above cannot be satisfied — missing specification, missing tests, unclear
ticket, or a required human gate — the agent MUST halt and report rather than produce a
change that merely *looks* correct. A technically valid change that violates these rules
is a failed change.
