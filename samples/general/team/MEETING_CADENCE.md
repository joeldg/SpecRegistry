# Meeting Cadence

## Scope

This specification defines the standard recurring meetings for this team: their purpose, required participants, cadence, and expected outputs. It applies to every engineer and manager on the team.

## Intent

Recurring meetings exist to serve the team, not the other way around. Each meeting in this spec has a defined purpose, mandatory outputs, and a clear owner. Meetings without a purpose or without outputs should be cancelled.

## Standard Meetings

### Daily Standup

| Field | Value |
| --- | --- |
| Cadence | Daily, <!-- async by 10am / synchronous at HH:MM tz --> |
| Duration | <!-- 15 minutes (sync) / 5 minutes per person (async) --> |
| Required participants | All engineers on the team |
| Owner | Rotates weekly |

**Purpose:** Surface blockers and synchronize on the day's priorities.

**Format (sync):** Each person answers: What did I do yesterday? What am I doing today? Is anything blocking me?

**Format (async):** Post to `<!-- #standup -->` using this template:
```
Yesterday: ...
Today: ...
Blockers: none / ...
```

**Expected output:** Blockers surfaced and routed to the right person immediately.

---

### Sprint Planning

| Field | Value |
| --- | --- |
| Cadence | Start of every <!-- 2-week --> sprint |
| Duration | <!-- 60 minutes --> |
| Required participants | Engineers, tech lead, product manager |
| Owner | <!-- Scrum master / tech lead --> |

**Purpose:** Commit to a sprint goal and select tickets from the backlog.

**Expected outputs:**
- Sprint goal documented in the issue tracker
- Sprint backlog selected and estimated
- Blockers identified before the sprint begins

---

### Sprint Retrospective

| Field | Value |
| --- | --- |
| Cadence | End of every sprint |
| Duration | <!-- 45 minutes --> |
| Required participants | All team members |
| Owner | Rotates |

**Purpose:** Reflect on what worked, what did not, and agree on one concrete improvement for the next sprint.

**Expected outputs:**
- Written summary of discussion posted to `<!-- #team channel -->`
- At least one action item with an owner and a due date
- One cancelled or modified process if a recurring pain point is identified

---

### Architecture Review

| Field | Value |
| --- | --- |
| Cadence | <!-- Bi-weekly or on-demand for significant changes --> |
| Duration | <!-- 60 minutes --> |
| Required participants | Tech leads, senior engineers, and the author of the proposed change |
| Owner | Tech lead |

**Purpose:** Review significant technical decisions, proposed ADRs, and cross-team impacts before implementation.

**Expected outputs:**
- Decision: approved, approved with changes, or rejected with rationale
- ADR updated with the decision and consequences
- Action items for follow-up questions

---

### On-Call Handoff

| Field | Value |
| --- | --- |
| Cadence | End of each on-call rotation (<!-- weekly -->) |
| Duration | <!-- 30 minutes --> |
| Required participants | Outgoing and incoming on-call engineers |
| Owner | Outgoing on-call |

**Purpose:** Transfer context about open incidents, unusual system behavior, and pending alerts from the outgoing to the incoming on-call.

**Expected outputs:**
- Written handoff document posted to `<!-- #on-call-handoff channel -->`:
  - Open incidents and their status
  - Any unusual system behavior observed during the rotation
  - Alerts that fired and their resolutions
  - Runbook gaps discovered

---

### 1:1 (Manager ↔ Engineer)

| Field | Value |
| --- | --- |
| Cadence | Weekly |
| Duration | <!-- 30 minutes --> |
| Required participants | Manager and direct report |
| Owner | The direct report drives the agenda |

**Purpose:** Career development, feedback, and surfacing concerns that are not appropriate for group settings.

**Not the purpose:** Sprint status updates (those belong in standup).

---

## Meeting Hygiene Rules

- Every recurring meeting has an agenda template; the owner prepares it at least <!-- 24 hours --> before.
- Meetings end with a written summary of decisions and action items.
- If a meeting consistently ends with nothing decided or no actions, it is cancelled or restructured.
- Meetings are not the default channel for decisions — decisions that do not require real-time discussion are made asynchronously and recorded in the `DECISION_LOG.md`.

## Acceptance Evidence

- Every standard meeting has an owner and an agenda template.
- Action items from meetings are tracked in the issue tracker.
- Meetings that consistently run over time or produce no outputs are reviewed and restructured.

## Token Budget Class

Reference detail. Load on demand for team process and planning tasks.

## Related Specs

- `DECISION_LOG.md` — where async decisions are recorded between meetings.
- `INCIDENT_RESPONSE.md` — the on-call handoff meeting is triggered by the incident response process.

## AI Agent Directives

When asked to schedule or facilitate a meeting, verify which meeting type from this spec applies and use the defined format. When a meeting produces a decision, offer to record it in `DECISION_LOG.md`. When a meeting produces action items, ensure they have owners and due dates before the meeting closes.
