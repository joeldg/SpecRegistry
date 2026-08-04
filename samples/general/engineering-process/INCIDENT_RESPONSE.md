# Incident Response

## Scope

This specification defines how production incidents are detected, classified, escalated, managed, and resolved. It covers severity tiers, on-call responsibilities, communication, and post-mortem requirements. It applies to any unplanned interruption or degradation of a production service.

## Intent

Fast, structured incident response minimizes customer impact. Clear roles and escalation paths prevent confusion during high-stress situations. Post-mortems close the loop by turning failures into permanent improvements.

## Severity Tiers

| Severity | Definition | Response SLA | Example |
| --- | --- | --- | --- |
| SEV-1 | Complete service outage or critical data loss | Acknowledge in <!-- 5 min -->; resolve or mitigate in <!-- 1 hour --> | Auth down, payments failing, data corruption |
| SEV-2 | Major feature degraded, significant customer impact | Acknowledge in <!-- 15 min -->; resolve in <!-- 4 hours --> | Slow API, partial feature failure |
| SEV-3 | Minor degradation, limited customer impact | Acknowledge in <!-- 1 hour -->; resolve in <!-- 1 business day --> | Non-critical feature broken, cosmetic issue |
| SEV-4 | No customer impact; internal or operational issue | Acknowledge in <!-- 1 business day --> | Log noise, staging environment issue |

Severity is assessed by the first responder and may be upgraded or downgraded as more information becomes available.

## On-Call Roles

| Role | Responsibility |
| --- | --- |
| Incident Commander | Owns the incident timeline and communication; makes the call on escalation and rollback |
| Technical Lead | Drives investigation and mitigation; coordinates engineering resources |
| Communications Lead | Drafts internal and external status updates; manages stakeholder communication |

On SEV-3 and SEV-4 incidents, one person may cover all roles.

## Escalation Path

1. Alert fires → On-call engineer acknowledges within the SLA.
2. If not mitigated within half the resolution SLA → escalate to secondary on-call and engineering manager.
3. SEV-1 and SEV-2 → notify executive stakeholders and activate the Communications Lead.
4. Data loss or security breach → notify the security team and legal immediately, regardless of severity tier.

## War Room Protocol

For SEV-1 and SEV-2 incidents:

1. Open a dedicated incident channel (e.g. `#inc-YYYY-MM-DD-slug`).
2. Post a running timeline: every significant action, finding, and decision with a timestamp.
3. No side-conversations — all decisions in the incident channel so the timeline is complete.
4. Declare the incident resolved only when metrics return to baseline and the fix is verified stable.

## Communication Templates

**Internal status update (post every <!-- 30 minutes --> during a SEV-1/2):**
> `[HH:MM UTC] SEV-X | <service> | Status: investigating / mitigating / resolved | Impact: <description> | Next update: HH:MM`

**External status page update:**
> `We are investigating an issue affecting <feature>. We will provide an update by <time>.`

Do not speculate about root cause in external communications until it is confirmed.

## Post-Mortem Requirements

Every SEV-1 and SEV-2 incident requires a blameless post-mortem within <!-- 5 business days --> of resolution. SEV-3 incidents require a post-mortem when the same issue recurs more than once.

A post-mortem must include:

- Incident timeline with timestamps
- Root cause (technical and contributing factors)
- Customer and business impact
- What went well
- What went wrong (process and technical)
- Action items with owners and due dates

Post-mortems are shared with the engineering team and linked to the incident ticket.

## Acceptance Evidence

- Every SEV-1 and SEV-2 incident has a linked post-mortem document.
- On-call acknowledgement times are tracked and reviewed quarterly.
- Action items from post-mortems have owners and due dates.
- Status updates during incidents are timestamped and preserved in the incident channel.

## Token Budget Class

Workflow rule. Load for incident response, on-call, and post-mortem tasks.

## Related Specs

- `ON_CALL_RUNBOOK.md` — per-service triage steps and escalation contacts.
- `RELEASE_PROCESS.md` — rollback procedure for release-caused incidents.
- `LOGGING_STANDARD.md` — log format and retention needed for incident investigation.

## AI Agent Directives

During an incident, follow the severity tier response SLA. Post timestamped updates in the incident channel. Do not speculate about root cause in external communications. Escalate to a human immediately for SEV-1 incidents, data loss, or security breaches — do not attempt autonomous resolution of production-critical failures.
