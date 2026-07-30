# Code Trace Scope

## Governed Entity Denominator

Code inventory records all supported entities, but coverage and drift measure only
implementation surfaces that can reasonably assert a governing contract:

- routes, commands, configuration, schemas, migrations, indexes, and classes;
- exported functions, interfaces, and types;
- class methods whose exported class forms a public implementation surface; and
- any internal entity carrying an explicit `@spec[FILENAME.md#section-anchor]` annotation.

Private helpers, local callbacks, and internal data-shape aliases remain searchable in the
inventory but do not count as uncovered governance by default. This prevents compliance
scores from rewarding blanket annotations on implementation details that no specification
actually governs.

## Evidence Semantics

An entity in the denominator is linked when an explicit annotation or a supported trace
matcher identifies a governing specification. Exact section evidence is claimed only by a
valid explicit annotation. Waivers remain available for exceptional public surfaces and
must include a reviewable rationale.

## Acceptance Evidence

- Extraction tests distinguish exported declarations from internal helpers.
- Coverage tests prove internal helpers remain in the inventory but outside the governed
  denominator unless explicitly annotated.
- Routes and other runtime boundary entities remain governed regardless of export syntax.
- Existing schema V1 and V2 inventories remain readable when export metadata is absent.

## AI Agent Directives

Do not export code or add annotations solely to improve coverage. Treat an unlinked public
surface as missing implementation evidence and an uncounted internal helper as inventory,
not proof of governance.
