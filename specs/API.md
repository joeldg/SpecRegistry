# Web App Standard — API Specification

## Scope

This specification governs REST or JSON API endpoints in Web App Standard projects.
It defines the contracts, validation, error shapes, and traceability requirements that
all Web App Standard API surfaces must satisfy.

## Intent

Consistent API contracts prevent silent breaking changes, protect consumers from
undocumented error shapes, and ensure that API surfaces are traceable to reviewed
specifications. Uniform validation and error handling reduce the debugging surface for
both human developers and AI agents.

## Requirements

### Endpoint Specification
1. Every endpoint spec must document: HTTP method, path, purpose, authentication
   requirements, request shape, response shape, and compatibility expectations.
2. Health and readiness endpoints must return stable JSON with documented status codes.
   The minimum health shape is `{"status": "ok"}` on HTTP 200.
3. Breaking response or path changes require a major spec delta and a migration checklist
   before the change request is approved.

### Request and Response Contracts
4. Request validation must occur at the API boundary, not inside domain logic.
5. Response payloads must be stable, schema-described, and covered by tests.
6. Optional fields must be explicitly documented as optional; their absence must never
   cause a client error on a well-formed request.

### Errors
7. Unknown routes must return a documented 404 shape. The minimum shape is
   `{"error": "<message>"}` or `{"statusCode": 404, "error": "Not Found", "message": "..."}`.
8. Validation failures must return 400 with a JSON error body.
9. Authorization failures must return 403 with a JSON error body.
10. Error responses must not leak secrets, stack traces, or internal database identifiers.

### Authentication
11. API routes that require authentication must enforce it at the middleware layer, not
    inside individual handlers.
12. Public routes (health checks, public-key metadata) must be explicitly documented as
    unauthenticated.

### Traceability
13. Route declarations, API handlers, response helpers, and package commands that serve
    the API should map to the governing project or project-type API spec via
    `@spec[API.md#<section>]` annotations or equivalent traceability markers.

## Non-Goals

- This spec does not define WebSocket, gRPC, or GraphQL contracts. Those require
  separate project-type or project-scoped specs.
- This spec does not define rate limiting policy or SLA targets. Those belong in
  operational or project-scoped specs.
- This spec does not govern internal service-to-service communication that is not
  exposed over the public API boundary.

## Acceptance Evidence

- Every API route that ships has a corresponding spec entry (or an open feedback item
  explaining the gap).
- Unknown routes return a documented 404 JSON shape in integration tests.
- Validation failures return 400 JSON bodies in tests.
- Authorization failures return 403 JSON bodies in tests.
- Error responses in tests do not contain stack traces or raw database error strings.

## Token Budget Class

Workflow rule. Load for API development, review, and traceability tasks in Web App
Standard projects.

## Related Specs

- `DESIGN.md` — runtime architecture and route registration pattern.
- `GLOBAL_SECURITY.md` — authentication and TLS requirements.
- `SECURITY_AND_SECRETS.md` — secrets handling in API responses.
- `TRACEABILITY_AND_OBSERVABILITY.md` — traceability annotation requirements.
- `CODING_STANDARDS.md` — implementation quality and test requirements.

## AI Agent Directives

Before adding or changing an API route, verify the endpoint contract exists in this spec
or a project-scoped API spec. If no spec covers the route, file spec feedback before
implementing. Do not generate error responses that include stack traces or raw database
errors. Ensure every new route has a corresponding test for the documented status codes.
