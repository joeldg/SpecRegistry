# Spec Authoring Standard

## Scope
This specification applies to all Markdown specifications authored, generated, reviewed, or published through SpecRegistry.

## Intent
Specs should constrain implementation, preserve intent, and earn their prompt budget. A good spec is specific enough to audit and short enough to use.

## Requirements
1. Every spec must state its scope and the outcome it protects.
2. Every spec must separate requirements from examples, references, and non-goals.
3. Every normative rule must be testable, auditable, or reviewable as evidence.
4. Every spec should include acceptance evidence describing how humans, CI, or agents verify conformance.
5. Specs must identify their token budget class: global invariant, project contract, workflow rule, reference detail, or temporary migration.
6. Specs that intentionally narrow or override broader guidance must say so explicitly and name the broader spec.
7. Generated specs must be reviewed for intent, contradictions, examples, and token cost before publication.
8. Specs should avoid volatile implementation details unless those details are the contract.

## Non-Goals
This spec is not a writing style guide for prose polish. It defines the minimum structure required for governed, observable SDD.

## Acceptance Evidence
- New specs contain scope, intent, requirements, non-goals, acceptance evidence, token budget class, related specs, and AI directives.
- Reviewers can identify at least one concrete way to audit each requirement.
- Search results can return meaningful sections because headings are specific.

## Token Budget Class
Global invariant. Load by default for spec generation, review, and draft-fix work.

## Related Specs
- `SPEC_GOVERNANCE.md`
- `TOKENOMICS.md`
- `TRACEABILITY_AND_OBSERVABILITY.md`

## AI Agent Directives
When generating or editing specs, preserve the required sections. Do not convert examples into requirements unless the user or reviewer explicitly asks for that contract.
