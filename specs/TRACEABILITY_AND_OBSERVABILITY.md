# Traceability and Observability

## Scope
This specification applies to manifests, MCP/spec reads, searches, feedback, audits, code trace reports, metrics, and reports that explain whether SDD is working.

## Intent
The registry must show which specs governed which work, whether code is covered by specs, when specs drift or conflict, and when a spec is followed literally but fails to express the intended outcome.

## Requirements
1. Governed repositories must report manifest usage through `specreg check`, `specreg sync`, or equivalent automation.
2. Repositories should run `specreg code-map --report` when code metadata is available so implementation surfaces can be linked to specs.
3. Reports must expose project spec drift, code-to-spec coverage, code drift severity, unmapped code entities, open feedback, pending reviews, stale specs, and token ROI signals.
4. Feedback must preserve spec, version, actor/agent, issue type, description, and context evidence.
5. Audit prompts and conformance audits should cite exact spec sections when possible.
6. Metrics endpoints must expose SDD health signals in a form Prometheus/Grafana can scrape or receive through an approved collector.
7. Traceability sidecars must not rewrite source files unless an explicit inline metadata workflow is enabled and reviewed.
8. Perfect spec compliance with wrong user or operational outcome must be recorded as a spec flaw or missing-intent feedback.

## Non-Goals
This spec does not require surveillance of developer behavior. It requires explainable evidence for governed decisions and repeated SDD failures.

## Acceptance Evidence
- Reports show current manifest consumers and code trace summaries.
- `.spec/code-trace.json` includes links, coverage, drift, aliases, and unmapped entities when generated.
- Feedback clusters can be triaged into spec changes, code changes, or intentional waivers.
- Metrics include registry, review, usage, and SDD health counts.

## Token Budget Class
Global invariant plus reporting contract. Load for audit, reports, CI, and governance work; search-first for detailed telemetry tables.

## Related Specs
- `SDD_OPERATING_MODEL.md`
- `IMPLEMENTATION_EVIDENCE.md`
- `TOKENOMICS.md`

## AI Agent Directives
When work changes code structure, APIs, schemas, commands, or config, prefer generating a code trace report and mention unmapped entities. Report missing spec coverage instead of pretending all code is governed.
