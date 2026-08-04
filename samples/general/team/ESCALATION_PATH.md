# Escalation Path

## Scope

This specification defines who to contact for each type of problem, with expected response times. It applies to every engineer, product manager, and on-call responder on this team.

## Intent

Knowing who to contact in a crisis eliminates the delay of searching for the right person. This spec is a directory of escalation paths — not a hierarchy, but a routing table.

## How to Use This Spec

Find the type of problem in the table that best matches your situation. Contact the listed person or channel. If you cannot reach them within the expected response time, escalate to the next level.

Do not escalate past one level without attempting the previous level first, except in SEV-1 incidents where time is critical.

## Technical Blockers

| Problem | First contact | Response time | Next escalation |
| --- | --- | --- | --- |
| Stuck on a technical problem (implementation, debugging) | Buddy / pair programmer | Immediate | Tech lead (same day) |
| Architectural question or design decision | Tech lead | <!-- 4 hours --> | Engineering manager (next day) |
| Dependency on another team's API or data | Tech lead reaches out to other team's lead | <!-- 1 business day --> | Engineering manager |
| Build / CI consistently broken | On-call engineer | <!-- 2 hours --> | Tech lead |
| Production incident | On-call engineer | <!-- 5 minutes --> (SEV-1) | Engineering manager, then CTO |

## Security Concerns

| Problem | Contact | Response time |
| --- | --- | --- |
| Suspected credential leak or exposure | <!-- security@example.com + engineering manager --> | Immediately |
| Vulnerability discovered in code or dependency | Tech lead + <!-- security@example.com --> | <!-- 24 hours --> for Critical |
| Phishing attempt or social engineering | IT security | Immediately |
| Data breach suspected | <!-- security@example.com + legal + engineering manager --> | Immediately |

Do not attempt to investigate a security incident alone. Notify the contacts listed and let them lead.

## Compliance and Legal Questions

| Problem | Contact | Response time |
| --- | --- | --- |
| Data handling or privacy question | <!-- privacy@example.com --> | <!-- 1 business day --> |
| Contract or vendor agreement question | <!-- legal@example.com --> | <!-- 2 business days --> |
| Regulatory compliance concern | Engineering manager + legal | <!-- 1 business day --> |
| Subpoena, legal hold, or law enforcement request | Legal (do not act without legal guidance) | Immediately |

Never respond to a legal request or law enforcement contact without first notifying legal.

## Personnel Issues

| Problem | Contact | Response time |
| --- | --- | --- |
| Conflict with a colleague | Engineering manager | <!-- 1 business day --> |
| Harassment or misconduct | HR directly, or anonymously via <!-- reporting mechanism --> | Immediately |
| Performance or career concern | Direct manager | Next scheduled 1:1 or sooner |
| Burnout or mental health concern | Direct manager (confidential) | Immediately if urgent |

## Process Gaps

| Problem | Contact | Response time |
| --- | --- | --- |
| Specification is missing or unclear | Tech lead; file a spec feedback item | <!-- 1 business day --> |
| Runbook is wrong or outdated | On-call engineer; update the runbook | Immediately if causing an incident |
| This escalation path is wrong or missing a contact | Tech lead; update this spec | <!-- 1 business day --> |

## Contact Directory

| Role | Name | Slack | Email |
| --- | --- | --- | --- |
| Tech Lead | <!-- Name --> | <!-- @handle --> | <!-- email --> |
| Engineering Manager | <!-- Name --> | <!-- @handle --> | <!-- email --> |
| On-Call (current) | See <!-- PagerDuty / OpsGenie schedule --> | `<!-- #on-call -->` | |
| Security Team | <!-- Name --> | <!-- @handle --> | <!-- security@example.com --> |
| Legal | <!-- Name --> | <!-- @handle --> | <!-- legal@example.com --> |
| HR | <!-- Name --> | <!-- @handle --> | <!-- hr@example.com --> |

## Acceptance Evidence

- Every engineer can identify the correct first contact for each problem type.
- Contact information is verified quarterly.
- Escalation paths for security incidents are tested in the incident response drill.

## Token Budget Class

Reference detail. Load on demand during incidents, compliance questions, or when a contact is needed.

## Related Specs

- `INCIDENT_RESPONSE.md` — detailed escalation path for production incidents.
- `VULNERABILITY_MANAGEMENT.md` — security escalation for CVEs.
- `MEETING_CADENCE.md` — where team-level process concerns are raised.

## AI Agent Directives

This is a template. Fill in every `<!-- placeholder -->` with real names, handles, and email addresses before publishing. When encountering a situation that requires human escalation, reference this spec to identify the correct contact and stop work until the human responds. Never substitute your own judgment for a human decision when the problem type is listed here as requiring a human contact.
