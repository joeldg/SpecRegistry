# Logging Standard

## Scope

This specification defines the structured log format, required fields, prohibited fields, retention policy, and alerting expectations for all services. It applies to every log entry emitted by application code, background jobs, and infrastructure components.

## Intent

Consistent structured logs make incidents faster to diagnose. Without a standard, each service logs differently, making cross-service correlation impossible and forcing engineers to context-switch between log formats during an outage.

## Log Format

All logs must be structured JSON, one object per line, written to stdout. Log aggregators read from stdout; services must not write logs to files or manage log rotation themselves.

```json
{
  "timestamp": "2024-01-15T14:30:00.000Z",
  "level": "info",
  "service": "payment-api",
  "version": "2.4.1",
  "trace_id": "4bf92f3577b34da6a3ce929d0e0e4736",
  "span_id": "00f067aa0ba902b7",
  "request_id": "uuid-v4",
  "message": "Payment processed",
  "duration_ms": 142,
  "user_id": "usr_abc123"
}
```

## Required Fields

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `timestamp` | ISO 8601 UTC | Yes | When the event occurred |
| `level` | string | Yes | `debug`, `info`, `warn`, `error`, `fatal` |
| `service` | string | Yes | Service name, consistent with service registry |
| `version` | string | Yes | Service version (semver or git SHA) |
| `message` | string | Yes | Human-readable description of the event |
| `trace_id` | string | Yes (for request handling) | W3C trace context trace ID |
| `span_id` | string | Yes (for request handling) | W3C trace context span ID |
| `request_id` | UUID | Yes (for HTTP requests) | Unique ID for the request; returned in the `X-Request-ID` response header |
| `duration_ms` | integer | For operations with measurable duration | Elapsed time in milliseconds |

All other fields are optional context. Add them as needed for the specific event.

## Log Levels

| Level | When to use |
| --- | --- |
| `debug` | Detailed diagnostic information; disabled in production by default |
| `info` | Normal operations: requests handled, jobs completed, significant state changes |
| `warn` | Unexpected but recoverable situations that do not require immediate action |
| `error` | Failures that affect a single request or operation; service continues running |
| `fatal` | Failures that require the service to exit |

Do not use `error` for expected failure paths (e.g. a 404 is not an error; it is expected behavior). Reserve `error` for unexpected failures.

## Prohibited Fields

The following must never appear in log output, regardless of log level:

- Passwords, tokens, API keys, secrets, or signing keys
- Full credit card numbers, CVVs, or bank account numbers
- Social Security numbers or national ID numbers
- Full PII beyond what is necessary for the log's purpose (use `user_id`, not `email`)
- Session tokens or authentication cookies
- Raw request/response bodies that may contain any of the above

Before logging a request body or response, strip sensitive fields. When in doubt, do not log the value.

## Retention Policy

| Log type | Retention |
| --- | --- |
| Application logs (info, warn, error) | <!-- 30 days hot storage; 1 year cold archive --> |
| Debug logs | <!-- 7 days --> |
| Security / audit logs | <!-- 7 years --> |
| Access logs | <!-- 90 days --> |

Logs containing PII are subject to retention limits in `PRIVACY_AND_PII.md`, which take precedence.

## Alerting from Logs

The following log patterns must trigger alerts to the on-call rotation:

| Pattern | Alert severity |
| --- | --- |
| `level: fatal` | SEV-1 |
| `level: error` rate > <!-- 1% --> of requests over <!-- 5 minutes --> | SEV-2 |
| <!-- Specific error code or message --> | <!-- Severity --> |

Log-based alerts must be defined in code (e.g. log metric filters, alert rules) and reviewed alongside the code that emits the relevant log events.

## Acceptance Evidence

- All services emit JSON-structured logs to stdout with the required fields.
- No sensitive values appear in log output (verified by log sampling in CI or staging).
- Log-based alerts are defined and tested.
- Retention policy is configured in the log aggregator.

## Token Budget Class

Workflow rule. Load for logging implementation, observability design, and incident investigation tasks.

## Related Specs

- `DISTRIBUTED_TRACING.md` — how trace IDs propagate through logs.
- `METRICS_AND_ALERTING.md` — metrics that complement log-based alerting.
- `DATA_CLASSIFICATION.md` — which field values may appear in logs by sensitivity tier.

## AI Agent Directives

When generating code that emits log statements, include all required fields. Never log sensitive values — use IDs instead of raw values. Use the correct log level: `error` only for unexpected failures, not expected 404s or validation rejections. When adding a new error condition, define the corresponding log-based alert rule in the same PR.
