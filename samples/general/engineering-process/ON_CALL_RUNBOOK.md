# On-Call Runbook Template

## Scope

This is a template for per-service on-call runbooks. Duplicate this file for each service, fill in the service-specific sections, and publish it as a governed spec. The template structure is fixed; the content is yours to complete.

## Service Identity

| Field | Value |
| --- | --- |
| Service name | <!-- e.g. payment-api --> |
| Team owner | <!-- e.g. Payments Team --> |
| Primary on-call contact | <!-- PagerDuty/OpsGenie rotation or name --> |
| Secondary on-call contact | <!-- Escalation contact --> |
| Status page | <!-- URL --> |
| Runbook last reviewed | <!-- YYYY-MM-DD --> |

## Alert Context

List each alert this service fires, what it means, and what level of urgency it carries:

| Alert name | Severity | What it means |
| --- | --- | --- |
| `<!-- HighErrorRate -->` | SEV-<!-- 2 --> | <!-- More than X% of requests returning 5xx for N minutes --> |
| `<!-- HighLatency -->` | SEV-<!-- 3 --> | <!-- P99 latency exceeds X ms for N minutes --> |
| `<!-- DatabaseConnectionPoolExhausted -->` | SEV-<!-- 1 --> | <!-- No available DB connections; requests queuing --> |

## Triage Steps

Follow these steps in order when you are paged:

1. **Check the dashboard** — open `<!-- dashboard URL -->` and identify which metric is anomalous.
2. **Check recent deployments** — run `<!-- git log command or deployment log URL -->` to see if a release coincides with the alert.
3. **Check dependencies** — verify upstream services at `<!-- health check URLs -->` are healthy.
4. **Check error logs** — run `<!-- log query -->` and look for the first occurrence of the error.
5. **Identify blast radius** — determine which customers or features are affected before taking action.

## Common Failure Modes

| Symptom | Likely cause | First action |
| --- | --- | --- |
| <!-- 503s on all endpoints --> | <!-- Process crash or OOM --> | <!-- Check process logs; restart if confirmed --> |
| <!-- Slow DB queries --> | <!-- Missing index or lock contention --> | <!-- Check slow query log; kill long-running queries if safe --> |
| <!-- Auth failures --> | <!-- Expired token or config drift --> | <!-- Check token expiry; compare config against last known-good --> |

## Rollback Command

If a recent deployment is the likely cause:

```sh
# <!-- Replace with the actual rollback command for this service -->
<!-- kubectl rollout undo deployment/<service-name> -->
<!-- or: deploy --version <previous-tag> -->
```

Verify with: `<!-- health check command or URL -->`

## Escalation Contacts

| Situation | Contact |
| --- | --- |
| Not mitigated within half the SEV SLA | <!-- Engineering manager name / handle --> |
| Data loss suspected | <!-- Security team contact --> |
| Third-party dependency outage | <!-- Vendor support link or account rep --> |

## Post-Incident

After the incident is resolved:

1. Document the timeline in the incident ticket.
2. Notify stakeholders that the incident is resolved.
3. Schedule a post-mortem if SEV-1 or SEV-2 (see `INCIDENT_RESPONSE.md`).
4. Update this runbook if any triage step was incorrect or missing.

## Token Budget Class

Reference detail. Load on demand during incident response; search for the specific service runbook by name.

## Related Specs

- `INCIDENT_RESPONSE.md` — severity tiers, escalation path, and post-mortem requirements.
- `LOGGING_STANDARD.md` — where logs live and how to query them.
- `METRICS_AND_ALERTING.md` — what metrics this service must expose.

## AI Agent Directives

This is a template. Fill in every `<!-- placeholder -->` before publishing as a governed runbook for a real service. Do not publish a runbook with empty or placeholder escalation contacts — an on-call engineer must be able to follow it under pressure without guessing.
