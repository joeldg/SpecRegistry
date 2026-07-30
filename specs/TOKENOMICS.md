# Tokenomics

## Scope
This specification applies to how specs are loaded, searched, summarized, split, promoted, demoted, and evaluated for usefulness in agent workflows.

## Intent
Spec context is a scarce budget. Specs must earn their tokens by improving decisions, reducing ambiguity, and preventing drift without overwhelming agents.

## Requirements
1. Always-loaded specs must be compact, stable, and broadly applicable.
2. Large reference specs should be searchable and section-addressable rather than blindly loaded into every prompt.
3. Each spec must declare a token budget class and should be split when unrelated concerns compete for attention.
4. Token ROI should consider reads, searches, feedback frequency, efficacy lift, stale age, and audit findings.
5. Specs with repeated ambiguity feedback or low efficacy lift must be candidates for revision, splitting, or demotion to reference material.
6. Agent workflows should prefer focused search results for task-specific detail.
7. Generated context files must not hide drift or replace the signed manifest as the authority.
8. Temporary migration guidance must include a review or expiration expectation.

## Non-Goals
This spec does not minimize tokens at the expense of safety, compliance, or correctness. Critical invariants may deserve default loading.

## Acceptance Evidence
- Specs declare token budget class.
- Reports expose token ROI, search/read counts, stale specs, and feedback trends.
- Large specs have headings that search can retrieve independently.
- Reviewers can justify why a spec is always-loaded or search-first.

## Token Budget Class
Global invariant for context economics. Load for spec authoring, agent context design, and report review.

## Related Specs
- `SPEC_AUTHORING_STANDARD.md`
- `AGENT_OPERATING_RULES.md`
- `TRACEABILITY_AND_OBSERVABILITY.md`

## AI Agent Directives
Use the smallest governed context that can safely answer the task. If context is too broad, search specs by task terms and cite the retrieved sections.
