# Web App Standard — API Specification

## Scope
This specification governs REST or JSON API endpoints in Web App Standard projects.

## Endpoints
Every endpoint spec must list method, path, purpose, authentication requirements, request shape,
response shape, and compatibility expectations. Health/readiness endpoints must return stable JSON
and documented status codes.

## Request and Response Contracts
Request validation belongs at the API boundary. Response payloads must be stable, typed or
schema-described, and covered by tests. Breaking response or path changes require a major spec delta.

## Errors
Unknown routes must return a documented 404 shape. Validation and authorization failures must use
consistent JSON error payloads and must not leak secrets or internal stack traces.

## Traceability
Route declarations, API handlers, response helpers, and package commands that serve the API should
map to the governing project or project-type API spec.
