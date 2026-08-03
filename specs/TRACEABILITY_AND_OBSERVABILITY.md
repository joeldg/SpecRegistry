# Traceability and Observability

## Scope

This specification applies to manifests, MCP/spec reads, searches, feedback, audits, code
trace reports, context delivery, model-usage evidence, metrics, and reports that explain
whether Spec Driven Development is working.

## Intent

The registry must show which specs governed which work, whether implementation surfaces
are covered by current specs, when specs drift or conflict, and when literal compliance
still fails to express the intended outcome.

## Trace Links

1. Governed repositories report manifest usage through `specreg check`, `specreg sync`, or
   equivalent automation.
2. Repositories should run `specreg code-map --report` when code metadata is available.
3. An explicit `@spec[FILENAME.md#section-anchor]` annotation applies to the next supported
   code entity and asserts that the exact named section governs it.
4. A fuzzy match may link an entity to a specification, but it must not claim exact
   section evidence.
5. Trace readers and persistence support both verbose schema V1 payloads and compact
   dictionary-encoded schema V2 payloads. Optional section anchors remain backward
   compatible with older traces.
6. Traceability sidecars do not rewrite source files.

## Reports

Reports expose project spec drift, code-to-spec coverage, code drift severity, unmapped
entities, open feedback, pending reviews, stale specs, and available token/context signals.
Project section reports keep two signals separate:

- implementation evidence: exact code-entity links to a section in the latest project
  trace report;
- retrieval usage: observed delivery of that section into project context.

An absent signal creates a review candidate, not an automatic deletion decision. A section
may be process-only, missing an annotation, stale, or not yet implemented.

## Feedback and Outcome Evidence

Feedback preserves the spec, version, actor or agent, issue type, description, and supplied
context. Audits cite exact sections when possible. Perfect trace coverage with a wrong user
or operational outcome is recorded as a spec flaw, missing intent, or implementation flaw
rather than being hidden by the score.

## Metrics

Metrics endpoints expose registry, review, usage, and SDD-health signals in a form approved
collectors can scrape. Model-usage fields such as provider, model, prompt/completion tokens,
cost, latency, route, and agent session are reported when the caller actually supplies
them; absence must not be presented as measured zero.

## Non-Goals

This specification does not require surveillance of developer behavior, universal
line-by-line annotations, or invented telemetry. It requires explainable, truthful evidence
for governed decisions and repeated SDD failures.

## Acceptance Evidence

- Reports show current manifest consumers and code trace summaries.
- `.spec/code-trace.json` includes links, coverage, drift, aliases, and unmapped entities
  when generated.
- Exact section annotations survive trace encoding, upload, persistence, and reporting.
- Feedback can be triaged into spec changes, code changes, or intentional waivers.
- Metrics distinguish projected context costs from reported real model usage.

## Token Budget Class

Global invariant plus reporting contract. Load for audit, reports, CI, and governance work;
search first for detailed telemetry fields.

## Related Specs

- `SDD_OPERATING_MODEL.md`
- `IMPLEMENTATION_EVIDENCE.md`
- `TOKENOMICS.md`

## AI Agent Directives

When work changes code structure, APIs, schemas, commands, or configuration, generate an
honest trace report when available and mention unmapped entities. Add exact section
annotations only where the section truly governs the entity. Report missing coverage
instead of pretending all code is governed.
