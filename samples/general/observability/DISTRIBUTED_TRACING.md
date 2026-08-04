# Distributed Tracing

## Scope

This specification defines the trace propagation standard, sampling policy, required span attributes, and how traces link to logs and metrics. It applies to every service that handles inbound HTTP requests or calls other services.

## Intent

In a distributed system, a single user request spans multiple services. Without tracing, debugging a slow or failing request requires correlating logs across services by time — slow and error-prone. Consistent trace propagation makes the full request path visible from a single trace ID.

## Propagation Standard

This system uses the **W3C TraceContext** standard for trace propagation:

- Incoming requests are read for the `traceparent` header.
- If present and valid, the trace context is continued (same `trace-id`, new `span-id`).
- If absent, a new trace is started.
- The `traceparent` header is forwarded on all outbound service calls.
- The `tracestate` header is passed through unchanged if present.

`traceparent` format: `00-{trace-id}-{span-id}-{flags}`

Example: `traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01`

Do not use vendor-proprietary headers (X-B3-TraceId, X-Amzn-Trace-Id, etc.) as the primary propagation mechanism. If a vendor instrumentation library injects these, ensure W3C TraceContext is also set.

## Instrumentation

| What to instrument | Required? |
| --- | --- |
| Incoming HTTP request handlers | Yes |
| Outbound HTTP calls to other services | Yes |
| Database queries | Yes |
| Message queue produce / consume | Yes |
| External API calls | Yes |
| Background jobs | Yes, with a synthetic root span |
| Internal function calls | Optional; only when the function is a significant performance contributor |

Use the organization's approved tracing SDK: `<!-- OpenTelemetry SDK for <language> -->`. Do not use vendor-specific SDKs directly — wrap them behind OpenTelemetry so backends are swappable.

## Required Span Attributes

Every span must include:

| Attribute | Value |
| --- | --- |
| `service.name` | Service name (consistent with `LOGGING_STANDARD.md` `service` field) |
| `service.version` | Service version |
| `http.method` | HTTP method (for HTTP spans) |
| `http.url` | Full URL (sanitized — no credentials or sensitive query params) |
| `http.status_code` | Response status code |
| `db.system` | Database type (e.g. `postgresql`, `sqlite`) for database spans |
| `db.statement` | Query template (parameterized, not with literal values) for database spans |
| `error` | `true` if the span represents a failure |
| `error.message` | Short error description when `error: true` |

## Sampling Policy

| Environment | Sampling rate | Notes |
| --- | --- | --- |
| Production | <!-- 10% --> | Head-based sampling; increase to 100% for error traces |
| Staging | <!-- 100% --> | Full sampling for debugging |
| Development | <!-- 100% --> | |

Error traces (any span with `error: true`) are always sampled regardless of the head-based rate.

## Linking Traces to Logs

Every log entry for a traced request must include `trace_id` and `span_id` (see `LOGGING_STANDARD.md`). This enables jumping from a log entry to the full trace in the observability backend.

The trace ID in logs must match the W3C `trace-id` exactly (32 hex characters, no dashes).

## Linking Traces to Metrics

Use exemplars to link Prometheus histogram observations to the trace that produced them. This enables jumping from a slow metric bucket to the specific trace.

## Trace Retention

Traces are retained for <!-- 7 days --> in hot storage. Traces associated with incidents may be preserved for longer by tagging them in the tracing backend.

## Acceptance Evidence

- All services propagate the `traceparent` header on outbound calls.
- Traces span across service boundaries (end-to-end trace visible from a single `trace_id`).
- Log entries for traced requests include `trace_id` and `span_id`.
- Error traces are sampled at 100% regardless of the head-based sampling rate.

## Token Budget Class

Workflow rule. Load for observability implementation, service integration, and performance debugging tasks.

## Related Specs

- `LOGGING_STANDARD.md` — required log fields that include trace context.
- `METRICS_AND_ALERTING.md` — exemplars that link metrics to traces.
- `SLO_POLICY.md` — SLO burn-rate alerts that link to traces for investigation.

## AI Agent Directives

When implementing a new service or adding outbound calls, instrument with the approved OpenTelemetry SDK and include the required span attributes. Never use vendor-proprietary trace headers as the primary propagation mechanism. When generating log statements for traced code paths, include `trace_id` and `span_id`. Flag any service that does not propagate `traceparent` on outbound calls as a tracing gap.
