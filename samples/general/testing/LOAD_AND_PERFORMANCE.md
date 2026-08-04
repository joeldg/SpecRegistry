# Load and Performance

## Scope

This specification defines performance baselines, load test gate requirements, latency and throughput targets, and regression detection policy. It applies to every service endpoint and background job that handles user-facing traffic or has measurable performance SLAs. Replace placeholder values with your system's actual measurements.

## Intent

Performance problems discovered in production are expensive and disruptive. This spec establishes measurable targets and requires load testing for changes to critical-path code so that regressions are caught before they reach customers.

## Performance Targets

Set targets based on your system's actual baseline measurements. Replace the placeholder values:

| Endpoint / Operation | P50 latency | P99 latency | Throughput | Error rate |
| --- | --- | --- | --- | --- |
| `GET /api/v1/<!-- resource -->` | < <!-- 50ms --> | < <!-- 200ms --> | > <!-- 100 req/s --> | < <!-- 0.1% --> |
| `POST /api/v1/<!-- resource -->` | < <!-- 100ms --> | < <!-- 500ms --> | > <!-- 50 req/s --> | < <!-- 0.1% --> |
| <!-- Background job --> | <!-- n/a --> | < <!-- 5s --> per item | <!-- 1000 items/min --> | < <!-- 0.01% --> |

These targets apply under the defined load profile. Document your load profile:

- Concurrent users: <!-- 100 -->
- Sustained duration: <!-- 10 minutes -->
- Ramp-up time: <!-- 2 minutes -->
- Data volume: <!-- realistic production data subset -->

## When Load Tests Are Required

A load test is required before merging when a change:

- Modifies a database query on a table with more than <!-- 10,000 --> rows
- Changes caching behavior (adds, removes, or reduces cache TTL)
- Adds a new synchronous external API call to a critical-path endpoint
- Changes the concurrency model (thread count, connection pool size, queue workers)
- Is labeled with the `performance-risk` tag by the reviewer

For all other changes, the standard test suite (unit + integration) is sufficient.

## Load Test Tooling

| Tool | Used for |
| --- | --- |
| <!-- k6 / Locust / Gatling / JMeter --> | Load generation |
| <!-- Grafana / Datadog / CloudWatch --> | Metrics collection during the test |
| <!-- Custom scripts --> | Data setup and teardown |

Load tests live in `<!-- tests/load/ or load-tests/ -->` and can be run with: `<!-- npm run test:load / make load-test -->`.

## Regression Detection

A performance regression is defined as:

- P99 latency increases by more than <!-- 20% --> over the baseline for the same endpoint
- Throughput decreases by more than <!-- 15% -->
- Error rate increases by more than <!-- 0.05 percentage points -->

If a regression is detected:

1. Block the PR and attach the comparison report.
2. The author investigates root cause before re-running.
3. If the regression is intentional (trade-off for correctness or safety), document it in the PR and get explicit approval from the tech lead.

## Baseline Management

Performance baselines are measured quarterly on the `main` branch and stored in `<!-- docs/performance-baselines.json or similar -->`. Baselines are updated when:

- The underlying infrastructure changes (new hardware, different cloud instance type)
- A deliberate architectural change is approved that changes the performance profile
- The previous baseline is more than <!-- 6 months --> old

## Acceptance Evidence

- Load tests run and pass for changes that meet the trigger criteria.
- Performance comparison reports are attached to PRs with load test results.
- Regressions are either fixed or explicitly accepted with tech lead sign-off.
- Baselines are reviewed and updated on the defined schedule.

## Token Budget Class

Workflow rule. Load for critical-path implementation, infrastructure changes, and performance review tasks.

## Related Specs

- `TEST_STRATEGY.md` — where load tests fit in the overall test pyramid.
- `METRICS_AND_ALERTING.md` — production metrics that confirm the performance targets are being met.
- `SLO_POLICY.md` — SLOs derived from the performance targets defined here.

## AI Agent Directives

When implementing a change that meets the load test trigger criteria, include a load test or explicitly note that one is required. Do not propose changes to query patterns, caching, or connection pools without referencing the performance targets in this spec. If a performance regression is detected, report it as a blocking finding and do not recommend accepting it without tech lead sign-off and documented rationale.
