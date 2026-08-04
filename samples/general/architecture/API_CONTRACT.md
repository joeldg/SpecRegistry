# API Contract

## Scope

This specification defines the versioning, error shape, authentication, pagination, deprecation, and backwards-compatibility rules for this service's REST/JSON API. It applies to every endpoint exposed to external consumers (other services, CLI clients, third-party integrations, or end users).

## Intent

A stable, documented API contract is a promise to consumers. Breaking it without notice causes outages and erodes trust. This spec ensures that every change to the API surface is deliberate, versioned, and communicated.

## Versioning

| Approach | Rule |
| --- | --- |
| URL versioning | Major versions are expressed in the path: `/api/v1/`, `/api/v2/` |
| Breaking changes | Require a new major version; old version is maintained for <!-- 90 days --> minimum |
| Minor/patch changes | Backwards-compatible additions (new optional fields, new endpoints) do not require a version bump |

A breaking change is any change that could cause a well-formed existing client request to fail or return unexpected results. When in doubt, it is breaking.

## Request Conventions

- Content type for request bodies: `application/json`
- Date/time format: ISO 8601 UTC (`2024-01-15T14:30:00Z`)
- IDs: <!-- UUID v4 | opaque string | integer — choose one and record it here -->
- Boolean fields: JSON `true`/`false` (not `"true"`, `1`, or `"yes"`)

## Response Shape

All responses return JSON. Successful responses include the resource or collection at the top level. Error responses use the standard error shape (see Errors).

**Collection response:**
```json
{
  "data": [ /* array of items */ ],
  "pagination": {
    "page": 1,
    "per_page": 20,
    "total": 142,
    "next": "/api/v1/items?page=2"
  }
}
```

**Single resource response:**
```json
{
  /* resource fields at top level, or wrapped in a named key — choose one and be consistent */
}
```

## Pagination

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `page` | integer | 1 | 1-indexed page number |
| `per_page` | integer | <!-- 20 --> | Items per page; max <!-- 100 --> |

Responses include a `pagination` object. If `next` is absent, the consumer has reached the last page.

## Errors

All error responses use this shape:

```json
{
  "error": "human-readable message",
  "code": "MACHINE_READABLE_CODE",
  "details": [ /* optional: field-level validation errors */ ]
}
```

| Status | Meaning |
| --- | --- |
| 400 | Invalid request (missing field, wrong type, failed validation) |
| 401 | Not authenticated |
| 403 | Authenticated but not authorized |
| 404 | Resource not found |
| 409 | Conflict (duplicate, stale version) |
| 422 | Semantically invalid (passes validation but fails business rules) |
| 429 | Rate limit exceeded |
| 500 | Unexpected server error |

Error responses must not include stack traces, internal database IDs, or secrets.

## Authentication

| Mechanism | Applies to |
| --- | --- |
| `Authorization: Bearer <token>` | All protected endpoints |
| Public / unauthenticated | Health checks, public metadata endpoints — must be explicitly documented as such |

Authentication is enforced at the middleware layer, not inside individual handlers.

## Rate Limiting

Rate limits are returned in response headers:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1705329600
```

When the limit is exceeded, respond with `429` and include a `Retry-After` header.

## Deprecation Policy

1. Add `Deprecated: true` to the OpenAPI spec for the endpoint or field.
2. Return a `Deprecation` response header with the sunset date: `Deprecation: Sun, 01 Jun 2025 00:00:00 GMT`
3. Notify consumers through the changelog at least <!-- 90 days --> before removal.
4. Remove only after the sunset date has passed.

## Backwards Compatibility Rules

The following are always safe (non-breaking):
- Adding a new optional request field
- Adding a new optional response field
- Adding a new endpoint

The following are always breaking:
- Removing or renaming a field
- Changing a field's type
- Changing an endpoint's path or method
- Making an optional field required
- Changing error status codes for existing error conditions

## Acceptance Evidence

- Every endpoint is documented in the OpenAPI spec before shipping.
- Breaking changes are versioned and communicated <!-- 90 days --> in advance.
- Error responses in tests match the documented shape.
- No stack traces or secrets appear in error response bodies.

## Token Budget Class

Project contract. Load for API design, endpoint review, and consumer integration tasks.

## Related Specs

- `AUTHENTICATION_FLOWS.md` — token issuance, refresh, and revocation.
- `AUTHORIZATION_MODEL.md` — which roles may call which endpoints.
- `EVENT_SCHEMA.md` — async event contracts that complement this synchronous API.

## AI Agent Directives

Before adding or modifying an endpoint, verify the change against this spec. Classify every change as breaking or non-breaking before implementing. Do not generate error responses with stack traces or internal identifiers. Document every new endpoint in the OpenAPI spec in the same PR as the implementation.
