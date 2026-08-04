# Metrics and Alerting

## Scope

This specification defines the metrics every service must expose, alert ownership, runbook requirements, and on-call paging SLAs. It applies to every service that handles user traffic or participates in a critical business flow.

## Intent

You cannot fix what you cannot see. Consistent metrics across services make capacity planning, incident response, and SLO tracking possible. Clear alert ownership ensures pages reach the right people with the context they need.

## Required Metrics

Every service must expose the following metric categories:

### RED Metrics (for request-handling services)

| Metric | Type | Description |
| --- | --- | --- |
| `http_requests_total` | Counter | Total requests, labeled by `method`, `path`, `status_code` |
| `http_request_duration_seconds` | Histogram | Request latency, labeled by `method`, `path` |
| `http_request_errors_total` | Counter | 5xx responses, labeled by `method`, `path` |

### USE Metrics (for resource-bound components)

| Metric | Type | Description |
| --- | --- | --- |
| `process_cpu_usage` | Gauge | CPU utilization (0–1) |
| `process_resident_memory_bytes` | Gauge | Resident memory in bytes |
| `db_connection_pool_active` | Gauge | Active database connections |
| `db_connection_pool_idle` | Gauge | Idle database connections |
| `db_connection_pool_size` | Gauge | Total pool size |

### Business Metrics

Each service defines its own business metrics. Examples:

| Metric | Type | Description |
| --- | --- | --- |
| `<!-- orders_created_total -->` | Counter | Domain events that matter to the business |
| `<!-- queue_depth -->` | Gauge | Work backlog that indicates saturation |

Document your service's business metrics in the service's `PROJECT_PROFILE.md`.

## Metrics Endpoint

All services expose metrics at `GET /metrics` in Prometheus text format. The endpoint is:

- Unauthenticated (or accessible to the metrics scraper's network identity only)
- Documented as a public internal endpoint in `API_CONTRACT.md`
- Excluded from access logs to avoid noise

## Alerting Rules

Alerts must be defined as code (Prometheus alerting rules, Grafana alert rules, or equivalent), reviewed alongside the code that introduces the condition, and stored in `<!-- infrastructure/alerts/ or monitoring/ -->`.

Every alert must have:

| Field | Requirement |
| --- | --- |
| Name | Clear, specific, and unique |
| Severity | `page` (wakes someone up) or `ticket` (creates a ticket for next business day) |
| Condition | Specific metric query with a threshold |
| Duration | How long the condition must persist before firing (avoid flapping) |
| Owner | The team and rotation that receives the alert |
| Runbook link | URL to the relevant on-call runbook section |

### Required Alert Conditions

| Alert | Severity | Condition |
| --- | --- | --- |
| High error rate | page | `rate(http_request_errors_total[5m]) / rate(http_requests_total[5m]) > 0.01` for <!-- 5 minutes --> |
| High latency | page | `histogram_quantile(0.99, http_request_duration_seconds) > <!-- 1 --> ` for <!-- 5 minutes --> |
| Service down | page | No successful `/metrics` scrape for <!-- 2 minutes --> |
| Memory pressure | ticket | `process_resident_memory_bytes > <!-- 0.85 * limit -->` for <!-- 15 minutes --> |

## On-Call Paging SLA

| Severity | Acknowledge within | Escalate if not mitigated within |
| --- | --- | --- |
| `page` (SEV-1) | <!-- 5 minutes --> | <!-- 30 minutes --> |
| `page` (SEV-2) | <!-- 15 minutes --> | <!-- 2 hours --> |
| `ticket` | <!-- 1 business day --> | <!-- 3 business days --> |

Alerts that page outside business hours and resolve before acknowledgement must still be reviewed the next business day.

## Acceptance Evidence

- All services expose `/metrics` with the required RED and USE metrics.
- Alert rules are defined as code and reviewed in PRs.
- Every alert has a runbook link that resolves to an up-to-date runbook.
- Paging history is reviewed quarterly to reduce false-positive alert noise.

## Token Budget Class

Workflow rule. Load for observability design, alerting configuration, and on-call setup tasks.

## Related Specs

- `LOGGING_STANDARD.md` — log-based alerting that complements metrics alerts.
- `DISTRIBUTED_TRACING.md` — trace context that links metrics to specific requests.
- `SLO_POLICY.md` — SLOs derived from the metrics defined here.
- `ON_CALL_RUNBOOK.md` — runbooks that alerts link to.

## AI Agent Directives

When implementing a new service endpoint or background job, add the required RED or USE metrics to the implementation in the same PR. When generating alert rule configurations, include the name, severity, condition, duration, owner, and runbook link. Never generate an alert without a runbook link. Flag any service that lacks a `/metrics` endpoint as a governance gap.
