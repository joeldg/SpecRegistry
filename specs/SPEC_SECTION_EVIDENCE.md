# Project Spec Section Evidence

## Scope

This project-specific specification governs section-level evidence in code trace reports,
the SpecRegistry API, and the Reports dashboard for the concrete
`github.com/joeldg/SpecRegistry` repository.

## Trace Payload

1. An explicit `@spec[FILENAME.md#section-anchor]` annotation links the next governable
   code entity to both the named specification and the exact normalized section anchor.
2. Trace schema V1 links carry the optional `spec_section` field.
3. Trace schema V2 dictionary encoding carries section anchors without breaking readers of
   older tuples that do not contain a section value.
4. Fuzzy links that identify only a specification do not claim section-level evidence.

## Persistence

The registry stores the optional section anchor with each persisted code-trace link.
Database evolution is append-only and existing trace rows remain valid with a null section.

## Project Section Evidence Report

For a selected project, the API reports every section in its current effective governed
bundle and combines two independent signals:

- implementation evidence: explicit code-entity links to that exact section in the
  project's latest code trace report;
- retrieval usage: recorded project context deliveries for that section.

The report identifies sections with no implementation evidence and sections with no
retrieval observations. Absence is a review signal, not proof that guidance is obsolete:
process, security, documentation, governance, and operational sections may legitimately
have no direct code entity.

## Dashboard

The Reports → Projects view lets an operator select a project and inspect section evidence.
It shows the specification, section, implementation-link count, retrieval-delivery count,
and latest evidence timestamps. Sections lacking implementation evidence are visibly
highlighted and accompanied by the caution that reviewers must decide whether the section
is process-only, missing annotations, stale guidance, or missing implementation.

## Acceptance Evidence

- CLI tests prove exact section anchors survive V1 and V2 trace generation.
- Server tests prove section anchors are persisted and the project report distinguishes
  implementation links from context deliveries.
- Web build/tests verify the dashboard consumes the typed report.
- Existing trace payloads and database rows without section anchors remain readable.

## AI Agent Directives

Add section annotations only where the exact section governs the entity. Never manufacture
links to improve a percentage. Treat an unlinked section as a prompt for review and record
missing guidance, intentional process-only scope, or implementation drift explicitly.
