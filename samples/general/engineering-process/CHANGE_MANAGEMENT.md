# Change Management

## Scope

This specification governs how production changes are planned, classified, approved, and executed. It applies to code deployments, infrastructure changes, configuration changes, database migrations, and dependency updates that affect production systems.

## Intent

Uncontrolled changes are the leading cause of production incidents. This process exists to ensure that every production change is deliberate, reviewed, and reversible — and that high-risk changes receive proportionate scrutiny before they reach customers.

## Risk Classification

| Class | Definition | Examples |
| --- | --- | --- |
| Standard | Low-risk, reversible, well-understood procedure | Dependency patch, config flag toggle, routine deploy |
| Significant | Moderate risk or limited reversibility | Schema migration, new auth flow, third-party integration |
| High-risk | High blast radius, hard to reverse, or touches critical path | Data backfill, breaking API change, payment flow |
| Emergency | Production is down or at imminent risk; normal process cannot wait | SEV-1 hotfix |

When in doubt, classify upward.

## Approval Gates

| Risk class | Required approvals | Documentation required |
| --- | --- | --- |
| Standard | 1 peer review | PR description |
| Significant | 1 peer + 1 tech lead | Change request ticket with rollback plan |
| High-risk | 2 peers + tech lead + <!-- security / ops --> | Full change request with impact analysis and rollback test |
| Emergency | 1 approver (any senior engineer); retroactive review within 24 hours | Incident ticket |

## Change Request Ticket

Significant and high-risk changes require a change request ticket containing:

- What is changing and why
- Affected systems, services, and data
- Rollback procedure (must be tested or documented step-by-step)
- Expected duration and maintenance window if applicable
- Success and failure criteria
- Stakeholders notified

## Freeze Windows

Production deployments are prohibited during the following periods:

- <!-- e.g. Friday 18:00 – Monday 09:00 (local time) -->
- <!-- e.g. 72 hours before and after a major commercial event -->
- <!-- e.g. Any period declared frozen by the on-call lead or engineering manager -->

Emergency changes may bypass a freeze window with explicit approval from <!-- the on-call lead or engineering manager -->. All freeze-window bypasses are logged.

## Post-Change Validation

Every production change enters a minimum <!-- 30-minute --> observation window. The deploying engineer monitors error rate, latency, and business-critical metrics and confirms success in the change ticket before closing it.

Failed changes are rolled back immediately and treated as incidents.

## Acceptance Evidence

- Change tickets exist for Significant and High-risk changes with rollback plans before deployment.
- Freeze-window bypasses are logged with approver identity.
- Post-change observation is documented in the change ticket.
- Emergency changes have a retroactive review within 24 hours.

## Token Budget Class

Workflow rule. Load for deployment, infrastructure, and migration planning tasks.

## Related Specs

- `RELEASE_PROCESS.md` — the release checklist and versioning policy.
- `INCIDENT_RESPONSE.md` — what to do when a change causes an incident.
- `BRANCHING_STRATEGY.md` — how changes move through source control before deployment.

## AI Agent Directives

Classify every proposed production change before recommending it. Do not recommend deploying a Significant or High-risk change without a change request ticket and rollback plan. Do not deploy during freeze windows without documented approver sign-off. If a change fails post-validation, initiate rollback and open an incident ticket — do not attempt to fix forward without human approval.
