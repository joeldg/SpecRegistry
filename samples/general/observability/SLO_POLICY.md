# SLO Policy

## Scope

This specification defines how Service Level Objectives are defined, agreed, tracked, and reviewed. It covers error budget policy, burn-rate alerts, and the consequences of a depleted error budget. It applies to every user-facing service in this organization.

## Intent

SLOs make reliability commitments explicit and measurable. Without them, "the service is good enough" is a feeling, not a fact. With them, teams can make informed trade-offs between shipping features and investing in reliability — and customers know what to expect.

## Definitions

| Term | Definition |
| --- | --- |
| SLI (Service Level Indicator) | A metric that measures the quality of service (e.g. request success rate) |
| SLO (Service Level Objective) | A target for an SLI over a time window (e.g. 99.9% success rate over 30 days) |
| SLA (Service Level Agreement) | A contractual commitment to an SLO, with consequences for breach; defined by Legal/Sales, not Engineering |
| Error budget | The allowed amount of failure implied by the SLO (e.g. 0.1% = 43.8 min/month) |

## SLO Template

Every user-facing service must define at least one SLO:

| Field | Value |
| --- | --- |
| Service | <!-- service-name --> |
| SLI | <!-- e.g. Proportion of HTTP requests that return 2xx or 3xx --> |
| SLO target | <!-- e.g. 99.9% --> |
| Window | <!-- Rolling 30 days --> |
| Error budget | <!-- Derived: (1 - target) × window duration in minutes --> |
| Owner | <!-- Team name --> |
| Last reviewed | <!-- YYYY-MM-DD --> |

Common SLIs:

- **Availability:** `count(non-5xx responses) / count(all responses)`
- **Latency:** `count(responses < threshold_ms) / count(all responses)`
- **Freshness:** `count(data updated within threshold) / count(all checks)`

## Error Budget Policy

| Budget remaining | Action required |
| --- | --- |
| > 50% | Normal operations; feature work proceeds |
| 25–50% | Reliability review; at least one reliability improvement planned for next sprint |
| 10–25% | Feature freeze on the affected service; focus on reliability |
| < 10% | Full reliability incident; escalate to engineering manager; no new features until budget recovers |
| Exhausted | Post-mortem required; SLO target reviewed; stakeholders notified |

Error budget resets at the start of each <!-- monthly --> window. A chronic pattern of depletion triggers an SLO target review.

## Burn-Rate Alerts

Burn-rate alerts warn before the budget is exhausted. Configure at least these two tiers:

| Alert | Trigger | Severity |
| --- | --- | --- |
| Fast burn | Budget burning at <!-- 14x --> the sustainable rate for <!-- 5 minutes --> | Page (SEV-2) |
| Slow burn | Budget burning at <!-- 3x --> the sustainable rate for <!-- 1 hour --> | Ticket |

Fast burn means a brief but severe outage; slow burn means a persistent low-level problem that will exhaust the budget by end of window.

Burn-rate = (observed error rate) / (1 - SLO target)

## Review Cadence

SLOs are reviewed:

- **Monthly** — error budget consumption and trend analysis.
- **Quarterly** — SLO target appropriateness; tighten if the service is consistently over-achieving, loosen if budget depletion is forcing unsustainable reliability investment.
- **After every incident** that consumed more than <!-- 20% --> of the monthly error budget.

Review output: a decision to keep, tighten, or loosen the SLO target, documented in the service's spec or project profile.

## Acceptance Evidence

- Every user-facing service has a defined SLO with the required fields.
- Burn-rate alerts are configured at both the fast and slow tiers.
- Error budget consumption is visible in the observability dashboard.
- SLO review is documented and occurs on the defined cadence.

## Token Budget Class

Workflow rule. Load for reliability design, SLO definition, and incident review tasks.

## Related Specs

- `METRICS_AND_ALERTING.md` — the metrics that SLIs are derived from.
- `INCIDENT_RESPONSE.md` — how SLO breaches become incidents.
- `LOAD_AND_PERFORMANCE.md` — performance targets that align with latency SLOs.

## AI Agent Directives

When implementing or reviewing a user-facing service, verify that an SLO exists with the required fields. When generating alert configurations, include both fast-burn and slow-burn tiers derived from the defined SLO target. Do not recommend shipping a feature that significantly increases error rate without first checking the current error budget balance. Flag any service without a defined SLO as a governance gap.
