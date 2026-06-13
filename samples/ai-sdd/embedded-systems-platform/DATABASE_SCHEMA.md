# Database Schema and Data Model Specification

## Purpose

AI-generated changes can break data integrity, query performance, reporting, synchronization,
and rollback if the database model is not explicitly understood. This specification defines the
data model and the boundaries within which schema changes are safe.

## Schema Inventory

List tables, views, indexes, constraints, stored procedures, triggers, migrations, and the data
ownership boundaries between subsystems.

## Data Model

| Item | Requirement |
| --- | --- |
| Purpose | What business or system concept each table represents. |
| Entity relationships | Primary keys, foreign keys, cardinality, and ownership relationships are documented. |
| Naming standards | Rules for naming tables, columns, indexes, constraints, and migration files. |
| Data types | Column types are appropriate for expected values, precision, scale, and storage. |
| Constraints | Required, nullable, unique, check, and referential-integrity rules are explicit. |

## Indexing & Performance

Indexes must support the expected query patterns. The specification identifies large tables,
slow queries, missing indexes, redundant indexes, and high-risk joins so an agent can weigh the
performance impact of a change.

## Migration Policy

| Rule | Requirement |
| --- | --- |
| Creation | Schema changes are made through reviewed, versioned migration files. |
| Reversibility | Every migration has a tested rollback path. |
| Compatibility | Additive changes (new nullable column, new table) are safe; destructive changes (drop, retype, tighten a constraint) are breaking and require a coordinated migration. |

## Data Retention, Security & Compliance

Retention, archival, deletion, and soft-delete policies are documented. Sensitive data is
identified along with its access-control, encryption, and audit requirements.

## Test Requirements

Migration tests, rollback tests, seed-data tests, and query regression tests are required for
schema changes.

## AI Agent Directives

An agent must treat any destructive or constraint-tightening change as breaking, provide a
tested rollback, and run the migration and regression tests. It must never expose or relocate
sensitive data outside the documented access-control and encryption rules.
