# Event Schema

## Scope

This specification defines the envelope format, topic naming, schema versioning, consumer guarantees, and dead-letter policy for event-driven messaging in this system. It applies to every event produced or consumed by services in this organization, regardless of the underlying broker (Kafka, SQS, RabbitMQ, etc.).

## Intent

Events are contracts between services. A producer changing its event shape without notice breaks every downstream consumer silently. This spec ensures that event schemas are versioned, discoverable, and changed through a controlled process.

## Envelope Format

All events use a standard envelope regardless of payload type:

```json
{
  "id": "uuid-v4",
  "type": "com.example.service.entity.action",
  "version": "1.0",
  "timestamp": "2024-01-15T14:30:00.000Z",
  "source": "service-name",
  "correlation_id": "uuid-v4-or-null",
  "data": { /* event payload */ }
}
```

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | UUID v4 | Yes | Unique event ID; consumers use this for deduplication |
| `type` | string | Yes | Dot-separated reverse-domain event type (see Topic Naming) |
| `version` | string | Yes | Schema version of the `data` payload (`MAJOR.MINOR`) |
| `timestamp` | ISO 8601 UTC | Yes | When the event was produced |
| `source` | string | Yes | Producing service name |
| `correlation_id` | UUID or null | No | Trace ID linking related events across services |
| `data` | object | Yes | Event-specific payload |

## Topic / Event Type Naming

Event types follow a reverse-domain pattern: `<org>.<service>.<entity>.<action>`

Examples:
- `com.example.payments.invoice.created`
- `com.example.users.account.deactivated`
- `com.example.inventory.product.stock_updated`

Actions use past tense (things that happened, not commands). Topics are mapped 1:1 to event types where possible; fan-out topics aggregate multiple event types only when consumers have a legitimate need to subscribe to all of them.

## Schema Versioning

Event schema versions follow `MAJOR.MINOR`:

| Increment | When |
| --- | --- |
| MAJOR | Breaking change: removed field, changed type, renamed field, changed semantics |
| MINOR | Non-breaking addition: new optional field, new enum value |

Schema versions are stored in a schema registry at `<!-- schema registry URL -->`. Producers must register schemas before publishing events. Consumers validate incoming events against the registered schema.

Breaking schema changes require:
1. A new MAJOR version published to the schema registry.
2. A migration period where the producer publishes both old and new versions.
3. Consumer updates confirmed before the old version is retired.

## Consumer Guarantees

| Guarantee | Commitment |
| --- | --- |
| At-least-once delivery | Events may be delivered more than once; consumers must be idempotent |
| Ordering | Ordering is guaranteed within a partition key; cross-partition ordering is not guaranteed |
| Retention | Events are retained for <!-- 7 days -->; consumers must catch up within this window |
| Schema compatibility | MINOR version bumps are backwards-compatible; consumers need not redeploy for new optional fields |

## Dead-Letter Policy

Events that cannot be processed after <!-- 3 --> delivery attempts are routed to the dead-letter topic: `<!-- dlq-prefix -->.<original-topic>`.

Dead-letter events must be:
1. Alertable — the owning team receives an alert when DLQ depth exceeds <!-- 10 --> messages.
2. Replayable — the DLQ retains events for <!-- 30 days --> for manual replay.
3. Inspectable — the DLQ message includes the original event, the error, and the attempt count.

## Acceptance Evidence

- Every event type produced by this service is registered in the schema registry.
- Breaking schema changes go through a migration period with both versions published simultaneously.
- DLQ alerts are wired to the owning team's on-call rotation.
- Consumer services handle duplicate events without side effects.

## Token Budget Class

Project contract. Load for event-driven design, producer/consumer implementation, and schema change tasks.

## Related Specs

- `API_CONTRACT.md` — synchronous API contracts that complement this async surface.
- `DATA_MODEL.md` — canonical entity definitions that event payloads reference.
- `LOGGING_STANDARD.md` — correlation IDs must flow from events into service logs.

## AI Agent Directives

Before adding or modifying an event type, check the schema registry for existing schemas. Classify every schema change as breaking or non-breaking. Do not publish events with envelope fields missing. When a breaking change is required, implement the migration period (dual-version publishing) rather than cutting over immediately.
