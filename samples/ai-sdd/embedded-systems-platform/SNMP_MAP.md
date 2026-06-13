# SNMP Creation and Editing Specification

## Purpose

Defines how SNMP maps are created, edited, named, validated, and versioned. SNMP maps are a
contract with monitoring and management consumers; an unmanaged change to an OID or field can
silently break every downstream collector.

## OID Naming Rules

- New identifiers are assigned under the organization's enterprise OID arc following the
  documented allocation scheme.
- OIDs are never reused or reassigned; a retired OID is marked deprecated, not deleted.

## Field Definitions

| Attribute | Requirement |
| --- | --- |
| Type | The SNMP type is explicit and appropriate for the value. |
| Range | Valid value ranges are documented. |
| Units | Units are specified where the value is a measurement. |
| Description | Every field carries a human-readable description of what it reports. |

## Versioning Policy

SNMP map changes are tracked with a version and a changelog entry. Each change records whether
it is additive (new OID/field) or breaking (changed type, range, or semantics).

## Validation Rules

Both AI and human checks run before merge: the map must lint cleanly, every field must satisfy
its definition, and no existing OID may change meaning without a deprecation path.

## Regression Testing

Required checks run against existing consumers to confirm that a change does not break current
collectors. Affected maps are tested after every change.

## AI Agent Directives

An agent may not add, retype, or repurpose an OID without following the naming and versioning
rules, and must run the consumer regression checks. Any change that alters the meaning of an
existing field is breaking and must be flagged for human review.
