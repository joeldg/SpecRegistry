# Decision Log

## Scope

This specification defines a lightweight format for recording team-level decisions that are significant enough to preserve but do not warrant a full Architecture Decision Record. It applies to process decisions, tool choices, team agreements, and scope calls that engineers or managers need to reference later.

## Intent

Teams make dozens of decisions every week. Without a record, decisions get relitigated, reversed without awareness of why they were made, or forgotten entirely. This log captures the decision, who made it, why, and when — so future engineers and agents have context instead of mystery.

## When to Use This Log (vs. an ADR)

Use this log for decisions that:

- Affect how the team works together but not the product architecture
- Are reversible with low cost
- Do not require a formal review process
- Need a record but not a change request

Use an ADR (`ADR_TEMPLATE.md`) for decisions that:

- Change the system architecture, data model, or API surface
- Are hard to reverse
- Affect other teams or external consumers
- Require a governance review

## Entry Format

Add entries in reverse chronological order (newest at top). Keep each entry brief.

---

### [YYYY-MM-DD] — <!-- Title of the decision -->

**Decision:** <!-- What was decided, in one or two sentences. -->

**Context:** <!-- Why this decision needed to be made. What problem or question prompted it. -->

**Rationale:** <!-- Why this option was chosen over alternatives. Keep it to the key reason. -->

**Decided by:** <!-- Name, role, or "team consensus" -->

**Reversibility:** <!-- Easy | Moderate | Hard — how hard would it be to change this decision later? -->

**Review date (optional):** <!-- When to check if this decision is still right. -->

---

## Example Entries

---

### 2024-03-15 — Use Linear for issue tracking instead of Jira

**Decision:** The team migrates to Linear for all issue tracking starting 2024-04-01. Jira access is retained for cross-team dependencies.

**Context:** Sprint planning was consistently taking 90+ minutes due to Jira's slow UI and complex workflows. The team voted to try a lighter-weight tool.

**Rationale:** Linear's keyboard-driven UI and simpler data model match the team's workflow better. Cost is comparable. Migration of open tickets is handled by the PM.

**Decided by:** Engineering manager + team consensus

**Reversibility:** Moderate — existing ticket history stays in Jira; migration back would require re-importing.

**Review date:** 2024-06-15 — check if velocity has improved and pain points are resolved.

---

### 2024-02-08 — Standup format: async written update in Slack, no daily meeting

**Decision:** Daily standups move to an async format: each engineer posts a three-line update in `#standup` by 10am. The synchronous meeting is cancelled.

**Context:** The team spans two time zones and the 9am meeting was disruptive for the remote half.

**Rationale:** Written updates take less time, are searchable, and accommodate time zones. Blockers go directly to the relevant person rather than being announced to the group.

**Decided by:** Team consensus, approved by engineering manager.

**Reversibility:** Easy — meeting can be reinstated at any time.

---

## Maintenance

- This log is a shared team document. Any engineer may add an entry after the decision is made.
- Entries are not deleted; they are marked superseded if a later decision replaces them.
- The log is reviewed during retrospectives to check whether time-limited decisions need revisiting.

## Token Budget Class

Reference detail. Load on demand when context about a past team decision is needed.

## Related Specs

- `ADR_TEMPLATE.md` — for architectural decisions that require a formal review.
- `MEETING_CADENCE.md` — recurring meetings where team decisions are made.

## AI Agent Directives

When a team decision is made in conversation or during a task, offer to add an entry to this log with the standard format. When asked about why the team does something a certain way, search this log for a relevant entry before speculating. Do not delete or modify existing entries; if a decision is superseded, add a new entry referencing the old one.
