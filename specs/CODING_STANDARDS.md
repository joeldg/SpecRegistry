# General Coding Standards

## Scope

These standards apply across governed software repositories. Repository- and
project-type specifications may add stricter language, architecture, testing, and
deployment requirements.

## Principles

- Prefer clarity over cleverness and match the naming, structure, and idioms of the
  surrounding code.
- Search for an existing implementation before adding a helper, route, abstraction, or
  dependency. Reuse the owning subsystem's interface instead of copying logic.
- Keep effects and inputs explicit. Avoid hidden global state, dead code, commented-out
  implementation blocks, and speculative abstractions.
- Keep changes small enough to review and verify. Separate unrelated behavior changes.

## Architecture

1. Implementation must follow the current repository architecture and governed design
   specs; a generic layering preference must not override a documented local boundary.
2. Cross-package or cross-subsystem behavior uses defined interfaces and shared types
   rather than duplicating authorization, validation, persistence, or business rules.
3. Environment-dependent behavior is configured through the repository's established
   configuration path rather than new hard-coded values.
4. Database evolution follows the repository's migration policy and preserves supported
   existing data.
5. Public APIs, CLI commands, configuration, and generated artifacts remain backward
   compatible unless a reviewed specification explicitly authorizes a breaking change.

## Tests and Evidence

- Behavior changes include tests at the nearest useful boundary. Server behavior changes
  include server tests; encoding and compatibility changes include round-trip or fixture
  tests.
- Run the repository's required build, test, static-analysis, and compliance commands.
  Record failures and skipped checks honestly.
- A passing test suite does not override a specification conflict, missing intent, or
  observed wrong outcome. Report those as feedback.

## Documentation

Update repository documentation in the same change when a public API, command,
configuration option, deployment procedure, schema contract, or governed workflow changes.
Comments explain non-obvious constraints; specifications define the authoritative contract.

## Specification Versioning

Specification documents use Semantic Versioning. Breaking guidance changes are major,
additive guidance is minor, and non-behavioral clarification is patch.

## Reviews

No specification becomes active without the required SpecRegistry review. Code changes
remain subject to the repository's pull-request and protected-branch rules.

## AI Agent Directives

Apply the most specific current governed guidance. Do not manufacture trace links or tests
to improve a score. Surface architectural drift, duplicated logic, compatibility risk, and
missing guidance in the change summary or SpecRegistry feedback.
