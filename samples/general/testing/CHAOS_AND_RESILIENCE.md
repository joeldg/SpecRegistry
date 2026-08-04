# Chaos and Resilience

## Scope

This specification defines the failure scenarios that must be tested, how game day and chaos engineering exercises are run, how results are reviewed, and how findings become actionable tickets. It applies to every service that handles user traffic or participates in a critical business flow.

## Intent

Systems fail in unexpected ways. Resilience testing forces failures deliberately — before users experience them — so weaknesses are discovered and fixed on the team's schedule, not during an incident.

## Failure Scenarios

The following failure modes must be tested at least <!-- annually -->. Check the box when each scenario has a passing test or exercise result.

### Infrastructure Failures

- [ ] A single service instance is terminated (process crash / OOM kill)
- [ ] All instances of a service are terminated simultaneously (full outage)
- [ ] The primary database becomes unavailable for <!-- 30 seconds -->
- [ ] A database failover occurs (primary → replica promotion)
- [ ] Network connectivity between two services is interrupted for <!-- 60 seconds -->
- [ ] An external API dependency returns 500 errors for <!-- 5 minutes -->
- [ ] An external API dependency becomes completely unreachable

### Resource Exhaustion

- [ ] Database connection pool is exhausted
- [ ] Message queue depth reaches the maximum before consumers catch up
- [ ] CPU is pegged at 100% on one instance for <!-- 2 minutes -->
- [ ] Available memory drops below <!-- 10% --> on one instance

### Data and Protocol Failures

- [ ] Malformed or unexpected input arrives at the API boundary
- [ ] An event consumer receives a message with a schema it does not recognize
- [ ] A downstream consumer is slow (latency injection: <!-- 3x normal -->)
- [ ] A downstream consumer rejects requests (circuit breaker scenario)

### Human Error Scenarios

- [ ] A bad deployment rolls out (canary or blue/green abort)
- [ ] A database migration fails mid-run
- [ ] A secret is accidentally rotated without updating consumers

## Exercise Format

Run chaos experiments as:

1. **Targeted drill** — inject a specific failure in a staging or production-like environment; observe and record the system's behavior.
2. **Game day** — a scheduled team exercise where multiple failures are injected simultaneously; the team practices incident response while the system is deliberately degraded.

Before each experiment:
- Define the hypothesis: "When X fails, Y should happen within Z time."
- Define the blast radius: which services will be affected and what customer impact is acceptable.
- Ensure on-call is aware and a rollback procedure is ready.

After each experiment:
- Record whether the hypothesis was confirmed or refuted.
- Document unexpected behaviors.
- Create tickets for every gap discovered.

## Acceptance Criteria for a Scenario

A failure scenario is considered covered when:

1. The experiment has been run with a documented hypothesis.
2. The system behaved as expected OR a ticket was created for the unexpected behavior.
3. The result is recorded in the exercise log with a date and outcome.

## Exercise Log

Maintain an exercise log in `<!-- docs/resilience-log.md or equivalent -->` with:

| Date | Scenario | Hypothesis | Outcome | Tickets created |
| --- | --- | --- | --- | --- |
| <!-- YYYY-MM-DD --> | <!-- Scenario name --> | <!-- Expected behavior --> | <!-- Confirmed / Refuted --> | <!-- Links --> |

## Acceptance Evidence

- Every scenario in this spec has an entry in the exercise log from within the past <!-- 12 months -->.
- Tickets exist for every gap discovered during exercises.
- Game day results are shared with the engineering team.
- Closed tickets from previous exercises are verified in a follow-up experiment.

## Token Budget Class

Workflow rule. Load for resilience planning, game day design, and infrastructure review tasks.

## Related Specs

- `INCIDENT_RESPONSE.md` — the response process practiced during game days.
- `METRICS_AND_ALERTING.md` — monitoring that detects failures during experiments.
- `LOAD_AND_PERFORMANCE.md` — performance behavior under degraded conditions.

## AI Agent Directives

When reviewing a service design or implementation, check whether the failure scenarios in this spec are addressed. Flag missing circuit breakers, missing retry logic, or missing graceful degradation as findings. Do not claim a service is resilient without evidence from exercise results. When helping plan a chaos experiment, define the hypothesis and blast radius before recommending any failure injection.
