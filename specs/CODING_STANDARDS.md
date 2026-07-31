# General Coding Standards

## Scope

This specification applies to all source code authored, generated, or reviewed in
repositories governed by SpecRegistry, regardless of project type.

## Intent

Shared coding standards ensure that generated and hand-written code is readable, testable,
and traceable to reviewed specifications. Consistent practices across repositories reduce
cognitive overhead when agents or humans move between projects.

## Requirements

1. Prefer clarity over cleverness; code is read far more than it is written.
2. Every public interface must be documented in the repository's spec files before it is
   shipped.
3. All changes must ship with tests that exercise the changed behavior. Tests must reflect
   actual runtime behavior, not mocked approximations of it.
4. All specification documents must follow strict Semantic Versioning (MAJOR.MINOR.PATCH):
   breaking guidance changes are MAJOR; new guidance is MINOR; clarifications are PATCH.
5. No specification becomes active guidance without an approved review in SpecRegistry.
6. Generated code must not embed credentials, connection strings, or secrets; use the
   approved secret-manager or environment-variable indirection documented in
   `SECURITY_AND_SECRETS.md`.
7. Code that changes a public API, database schema, command interface, or authentication
   boundary must be accompanied by a corresponding spec update or spec feedback item.

## Non-Goals

- This spec does not prescribe language-specific style rules (indentation, naming
  conventions, formatter configuration). Those belong in project-type or project-scoped
  specs.
- This spec does not define test frameworks or coverage thresholds. Project-type specs
  define those contracts.
- This spec does not govern documentation prose style or Markdown formatting beyond what
  is required by the spec authoring standard.

## Acceptance Evidence

- Pull requests include tests that fail before the fix and pass after.
- New or changed public interfaces have corresponding spec entries or open feedback items
  before merge.
- Spec version deltas are classified correctly (major/minor/patch) in change requests.
- No committed file contains raw credentials or embedded secrets.

## Token Budget Class

Global invariant. Load by default because these rules apply to every implementation task
in every governed repository.

## Related Specs

- `SPEC_AUTHORING_STANDARD.md` — structure and quality requirements for spec documents.
- `SPEC_GOVERNANCE.md` — review, approval, and publication workflow.
- `SECURITY_AND_SECRETS.md` — credential handling and secret management.
- `IMPLEMENTATION_EVIDENCE.md` — evidence requirements for completed implementation work.

## AI Agent Directives

Before generating or modifying code, verify the change is covered by a current reviewed
spec. If no spec covers the behavior, file spec feedback rather than proceeding on
inferred convention. Do not embed credentials. Do not ship code without accompanying tests
unless the project-type spec explicitly exempts the change category.
