# Protocol Buffer / ICP Specification

## Purpose

Defines protobuf schema ownership, versioning, compatibility, and synchronization rules for
inter-application communication. Protobuf schemas are shared across applications, so a change
in one place must remain compatible everywhere the schema is consumed.

## Schema Ownership

| Item | Requirement |
| --- | --- |
| Owner | Each `.proto` file has a single owning subsystem responsible for changes. |
| Location | Schemas live in a shared, versioned location consumed by every application that depends on them. |
| Change authority | Only the owner approves schema changes; consumers may request them via ticket. |

## Versioning

Schemas are versioned, and field numbers are never reused. Removed fields are reserved, not
deleted, so old and new binaries can coexist during rollout.

## Compatibility Rules

- **Backward compatible** (minor): adding a new field with a new field number, or adding a new
  message or enum value.
- **Breaking** (major): changing a field's type or number, removing a field without reserving
  it, or renaming an enum value. Breaking changes require a coordinated, versioned migration.

## Synchronization

When a schema changes, every dependent application must be regenerated and re-validated. The
specification defines how generated code is kept in sync across applications so no consumer
runs against a stale schema.

## Test Requirements

Contract tests validate that serialized messages round-trip across the supported schema
versions, and that consumers tolerate additive changes without rebuild where the wire format
allows it.

## AI Agent Directives

An agent must never reuse a field number, never remove a field without reserving it, and must
regenerate and test every dependent application after a schema change. Cross-application schema
changes are breaking until proven compatible by the round-trip contract tests.
