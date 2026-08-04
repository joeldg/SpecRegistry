# Test Strategy

## Scope

This specification defines the test types required before a change may be merged, coverage expectations, what test categories are exempt, and the tools used for each layer. It applies to all services and packages in this repository. Replace the placeholder values with your team's actual thresholds.

## Intent

Tests are the mechanism by which changes prove they do not break existing behavior and do introduce the behavior they claim to. Without a documented strategy, coverage becomes arbitrary and regressions go undetected.

## Test Pyramid

| Layer | Purpose | Required before merge? |
| --- | --- | --- |
| Unit | Individual functions, pure logic, edge cases | Yes |
| Integration | Component interactions, database queries, message handling | Yes |
| Contract | API shape, event schema, CLI output conformance | Yes for public interfaces |
| End-to-end | Full user flows through the deployed system | Yes for critical paths; optional for all paths |
| Performance | Latency and throughput under load | Yes for changes to critical-path code (see `LOAD_AND_PERFORMANCE.md`) |

## Coverage Expectations

| Scope | Minimum line coverage | Notes |
| --- | --- | --- |
| New code | <!-- 80% --> | All new production code must meet this threshold |
| Changed code | <!-- 80% --> | Coverage must not regress below the threshold |
| Entire codebase | <!-- 70% --> | Enforced in CI; PRs that drop below this are rejected |

Coverage is a floor, not a goal. 100% line coverage with no assertions is meaningless. Tests must assert behavior, not just execute lines.

## What Must Be Tested

Every PR must include tests that:

1. Exercise the behavior described in the ticket's acceptance criteria.
2. Fail before the fix / feature and pass after.
3. Cover the happy path and at least one failure / edge case.
4. Do not rely on timers, external services, or network calls in unit tests (use fakes or stubs).

## What May Be Exempt

The following do not require additional tests:

- Documentation-only changes
- Dependency version bumps (covered by existing test suite)
- Configuration changes verified by existing integration tests
- Cosmetic UI changes without logic (verified manually)

Exemptions must be noted in the PR description.

## Test Tools

| Layer | Tool | Notes |
| --- | --- | --- |
| Unit / Integration | <!-- Jest / pytest / go test --> | |
| Contract | <!-- Pact / Dredd / custom schema validation --> | |
| End-to-end | <!-- Playwright / Cypress / Selenium --> | |
| Coverage | <!-- nyc / coverage.py / go cover --> | |
| Mutation (optional) | <!-- Stryker / mutmut --> | Recommended for critical logic |

## CI Enforcement

- Unit and integration tests run on every PR and every push to `main`.
- Coverage gates are enforced in CI — a PR that drops below the threshold is rejected automatically.
- E2E tests run against a staging environment on every merge to `main`.
- Test results are reported as PR checks; failing checks block merge.

## Acceptance Evidence

- PRs include new or updated tests that meet the coverage threshold.
- CI shows passing test results before merge.
- New behavior has tests that would fail without the implementation.
- Failure and edge cases are covered alongside the happy path.

## Token Budget Class

Workflow rule. Load for implementation, PR review, and CI configuration tasks.

## Related Specs

- `ACCEPTANCE_CRITERIA_STANDARD.md` — how to write the acceptance criteria that tests verify.
- `LOAD_AND_PERFORMANCE.md` — performance test requirements for critical-path changes.
- `CHAOS_AND_RESILIENCE.md` — failure scenario testing requirements.

## AI Agent Directives

Every code change must include tests that fail before the change and pass after. Do not claim a change is tested if the tests only execute code paths without asserting outputs. When generating tests, cover at least one failure or edge case alongside the happy path. If the coverage threshold would be breached, surface that as a gap requiring additional tests before the PR is complete.
