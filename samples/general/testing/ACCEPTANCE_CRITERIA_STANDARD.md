# Acceptance Criteria Standard

## Scope

This specification defines how to write acceptance criteria for tickets and specifications that are testable, auditable, and unambiguous. It applies to every ticket, user story, bug report, and spec requirement in this organization.

## Intent

Vague acceptance criteria produce vague implementations. "It should work" cannot be tested. "Returns HTTP 200 with `{status: 'ok'}` when the service is healthy" can be. This spec gives engineers and agents a shared definition of what good acceptance criteria look like.

## The Test for Good Acceptance Criteria

Good acceptance criteria pass all three checks:

1. **Specific** — A developer unfamiliar with the feature can implement it from the criterion alone.
2. **Testable** — A test can be written that fails when the criterion is not met and passes when it is.
3. **Observable** — The outcome is visible: a response code, a database row, a UI state, a log entry.

## Format

Write acceptance criteria in the Given/When/Then format or as a numbered checklist. Both are acceptable; be consistent within a ticket.

**Given/When/Then:**
```
Given [initial context or state]
When [action or trigger]
Then [observable outcome]
```

**Numbered checklist:**
```
- [ ] [Observable outcome that can be verified]
- [ ] [Another observable outcome]
```

## Rubric: Weak vs. Strong

| Weak | Why it fails | Strong |
| --- | --- | --- |
| "The API should be fast" | Not measurable | "The `GET /items` endpoint returns a response within 200ms at the 99th percentile under normal load" |
| "It should handle errors" | Not specific | "Returns HTTP 400 with `{error: 'email is required'}` when the `email` field is missing from the request body" |
| "Users can log in" | Not testable | "Given a valid username and password, when `POST /auth/login` is called, then a JWT access token is returned with a 15-minute TTL" |
| "Fix the bug" | No outcome | "The cart total does not include removed items after the user navigates away and returns to the cart page" |
| "The feature works correctly" | Circular | List the specific behaviors that constitute 'correct' |

## Required Sections in a Ticket

Every ticket must include:

1. **Objective** — What is the user or business goal?
2. **Acceptance criteria** — What specific, observable behaviors must be true when this is done?
3. **Out of scope** — What is explicitly not part of this ticket?
4. **Verification method** — How will acceptance criteria be verified? (automated test, manual test, review)

## Writing for Agents

When an AI agent will implement the ticket, acceptance criteria must be even more precise:

- Name the exact endpoint, function, or component.
- Specify input data, including edge cases and invalid inputs.
- Specify the exact expected output: status code, response shape, database state, log entry.
- Specify what must NOT happen: no side effects, no data leakage, no regression.

Agents cannot read between the lines. If it is not written, it will not be done.

## Acceptance Evidence

- Tickets in this project have acceptance criteria that pass the three-check rubric.
- Tickets implemented by agents include input/output specifications precise enough to write automated tests.
- "Done" means all acceptance criteria are verifiably met, not just the feature is coded.

## Token Budget Class

Workflow rule. Load for ticket writing, spec authoring, and requirement review tasks.

## Related Specs

- `TEST_STRATEGY.md` — how acceptance criteria become automated tests.
- `TICKET_WORKFLOW.md` — the full ticket lifecycle and governance requirements.

## AI Agent Directives

Before implementing a ticket, verify that its acceptance criteria pass the three-check rubric. If criteria are vague or untestable, report the gap and ask for clarification rather than proceeding with an interpretation. When writing acceptance criteria in a ticket or spec, apply the rubric: every criterion must be specific, testable, and observable. Prefer numbered checklists for multi-part criteria so each item can be verified independently.
