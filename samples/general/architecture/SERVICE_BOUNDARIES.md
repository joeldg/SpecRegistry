# Service Boundaries

## Scope

This specification defines what each service owns, the communication patterns allowed between services, shared-nothing enforcement, and data duplication policy. It applies to every service and package in this system.

## Intent

Clear service boundaries prevent the accidental coupling that turns a distributed system into a distributed monolith. When every service knows exactly what it owns and how it may communicate with others, changes can be made safely and independently.

## Service Inventory

List every service in the system. Duplicate the row for each one.

| Service | Owns | Does not own |
| --- | --- | --- |
| <!-- auth-service --> | User accounts, sessions, tokens | Orders, payments, inventory |
| <!-- order-service --> | Orders, line items | User accounts, product catalog |
| <!-- Add rows as needed --> | | |

## Communication Patterns

| Pattern | Allowed | When to use |
| --- | --- | --- |
| Synchronous REST/gRPC | Yes | Request-response where the caller needs an immediate answer |
| Async events / message queue | Yes | Notifications, state changes, fan-out to multiple consumers |
| Shared database | No | Never — each service owns its own store |
| Direct DB connection to another service | No | Never |
| Shared library (domain logic) | No | Extract to a dedicated service if logic must be shared |
| Shared library (utilities, types) | Yes | Serialization, logging, tracing — no business logic |

## Ownership Rules

1. A service is the sole writer to its own data store. No other service may write to it directly.
2. A service may read another service's data only through that service's API or event stream.
3. A service may cache another service's data locally for performance, but must treat the cache as stale and validate against the source within the defined TTL.
4. If two services find themselves needing to share the same table, that is a boundary violation — resolve it by clarifying ownership or extracting a new service.

## Data Duplication Policy

Duplicating data across service boundaries is sometimes necessary for performance or resilience. When duplicating:

1. The originating service is the system of record; the copy is always subordinate.
2. The copy is updated via events from the originating service, not by direct writes.
3. The duplication is documented here with the source, destination, fields, and sync mechanism.
4. Stale copies must be acceptable for the use case; if not, use synchronous API calls instead.

| Source service | Destination service | Fields duplicated | Sync mechanism | Stale tolerance |
| --- | --- | --- | --- | --- |
| <!-- user-service --> | <!-- order-service --> | `user_id`, `display_name` | `users.profile_updated` event | <!-- 5 minutes --> |

## Dependency Graph

<!-- Insert a diagram or description of the service dependency graph. Arrows point from consumer to dependency (A → B means A depends on B). -->

Dependency rules:
- No circular dependencies between services.
- If A depends on B and B depends on A, there is a boundary problem — resolve it.

## Acceptance Evidence

- No service opens a direct database connection to another service's store.
- All cross-service communication uses the documented patterns.
- Data duplication is listed in this spec before it is implemented.
- The dependency graph contains no cycles.

## Token Budget Class

Project contract. Load for architecture review, service design, and cross-service integration tasks.

## Related Specs

- `DATA_MODEL.md` — what each service's data store contains.
- `API_CONTRACT.md` — the synchronous communication contract.
- `EVENT_SCHEMA.md` — the async communication contract.
- `ADR_TEMPLATE.md` — document boundary decisions that require justification.

## AI Agent Directives

Before implementing a cross-service call, verify the communication pattern is allowed by this spec. Never generate code that opens a direct database connection to another service. If a proposed design requires a circular dependency or shared database, flag it as a boundary violation rather than implementing it. Document any data duplication in this spec before writing the sync code.
