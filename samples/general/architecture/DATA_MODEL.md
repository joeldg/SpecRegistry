# Data Model

## Scope

This specification defines canonical entity definitions, ownership boundaries, ID conventions, nullability rules, and schema migration policy for this system's persistent data. It applies to every database table, document collection, or data store owned by this service.

## Intent

A documented data model prevents schema drift, ownership ambiguity, and silent data loss. It ensures that every schema change is deliberate and that downstream consumers — services, reports, events — know what to expect.

## Canonical Entities

List every top-level entity owned by this service. Duplicate this table for each entity.

### <!-- Entity Name -->

| Field | Type | Nullable | Default | Description |
| --- | --- | --- | --- | --- |
| `id` | <!-- UUID / BIGINT --> | No | generated | Primary key |
| `created_at` | timestamp with TZ | No | now() | Record creation time |
| `updated_at` | timestamp with TZ | No | now() | Last modification time |
| <!-- field --> | <!-- type --> | <!-- Yes/No --> | <!-- value or none --> | <!-- description --> |

**Ownership:** This service is the system of record for this entity. No other service may write to this entity's table directly.

**Soft delete policy:** <!-- Records are hard-deleted | Records are soft-deleted via deleted_at; include WHERE deleted_at IS NULL in all active-record queries -->

## ID Conventions

| Rule | Value |
| --- | --- |
| Primary key type | <!-- UUID v4 | auto-increment BIGINT — choose one and record it here --> |
| Cross-service references | Stored as the foreign entity's ID type; no embedded foreign data |
| Surrogate vs natural keys | <!-- Surrogate IDs only; natural keys may be indexed but are not the PK --> |

## Nullability Rules

- Fields must be `NOT NULL` unless the absence of a value is a meaningful, expected state.
- Nullable fields must have a documented semantic for what `NULL` means (missing, unknown, opted-out, etc.).
- Never use an empty string as a substitute for `NULL`.

## Ownership Boundaries

| Entity | Owner service | Other services may |
| --- | --- | --- |
| <!-- Entity --> | <!-- This service --> | Read via API or event; never write directly |

No service may open a direct database connection to another service's store. Cross-service data access goes through the owning service's API or event stream.

## Migration Policy

1. All schema changes are expressed as numbered, append-only migration files.
2. Migrations must be backwards-compatible with the running application version for at least one deploy cycle (blue/green safe).
3. Destructive migrations (DROP COLUMN, DROP TABLE) require a two-step process: first deploy that stops writing the field, then a second migration that removes it.
4. Migrations must include a rollback path or an explicit statement that rollback is not possible (with a documented recovery procedure).
5. Migration files are reviewed alongside the code change that depends on them.

## Retention and Archival

| Entity | Retention | Archival target |
| --- | --- | --- |
| <!-- Entity --> | <!-- 90 days active; 7 years archived --> | <!-- cold storage / data warehouse --> |

Data subject to privacy regulations (see `PRIVACY_AND_PII.md`) must be purged or anonymized within the defined retention window.

## Acceptance Evidence

- Every table has a corresponding entry in this spec before shipping.
- Migration files are reviewed in the same PR as the code that uses the new schema.
- No service writes directly to another service's database.
- Destructive migrations follow the two-step process.

## Token Budget Class

Project contract. Load for data modeling, migration, and schema review tasks.

## Related Specs

- `PRIVACY_AND_PII.md` — PII fields, retention limits, and erasure requirements.
- `EVENT_SCHEMA.md` — event payloads reference entities defined here.
- `SERVICE_BOUNDARIES.md` — ownership rules for cross-service data access.

## AI Agent Directives

Before proposing a schema change, check this spec for the affected entity's ownership and migration policy. Classify every migration as backwards-compatible or destructive and implement accordingly. Never write migration code that bypasses the two-step destructive-change process. Flag any PII fields discovered in the data model and verify they are governed by `PRIVACY_AND_PII.md`.
