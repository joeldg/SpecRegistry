# API Development Specification

## Purpose

Defines REST/OpenAPI behavior and compatibility requirements for every HTTP API in the
platform. Existing OpenAPI/Swagger definitions are extracted into this formal specification
so that an agent changing an endpoint understands its contract, not just its current code.

## Endpoint Contract

| Item | Requirement |
| --- | --- |
| API purpose | Each endpoint documents what it is for and who consumes it. |
| Request & response body | The shape of each request and response is defined; deviations from the house standard must be explicitly justified. |
| Endpoint behavior | Expected request, response, error responses, and side effects are documented. |
| Validation rules | Schemas are validated against OpenAPI 3.0.3; linting and schema validation are required and explicitly configured. |

## Compatibility Policy

Compatibility is a firm contract because UI clients and external consumers depend on it.

- **Non-breaking** (minor): adding an optional field, a new endpoint, or a new optional query
  parameter.
- **Breaking** (major): removing or renaming a field, changing a type, tightening validation,
  or altering an existing status-code contract. Breaking changes require consumer sign-off.

## Test Requirements

- Contract tests and regression tests are required, ideally as Python test scripts embedded in
  the repo.
- Every API endpoint affected by a change must be tested after the change.
- A change to the request/response shape requires a corresponding contract-test update in the
  same pull request.

## Documentation

Any change to a public endpoint updates the API documentation in the same change, per the
Documentation Quality and Coverage specification.

## AI Agent Directives

An agent must classify every API change as breaking or non-breaking against the compatibility
policy, run the contract tests for the affected endpoints, and never silently relax or tighten
validation. If the compatibility classification is unclear, the agent files feedback instead of
choosing for the consumer.
