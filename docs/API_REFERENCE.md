# API Reference

## API Usage

List project types:

```sh
curl http://localhost:4000/api/v1/project-types
```

Create a draft spec:

```sh
curl -X POST http://localhost:4000/api/v1/specs \
  -H "content-type: application/json" \
  -d '{
    "project_type_id": "PROJECT_TYPE_ID",
    "filename": "API.md",
    "content": "# API\n\nContract goes here.",
    "updated_by": "alice"
  }'
```

Submit a governed change request:

```sh
curl -X POST http://localhost:4000/api/v1/specs/review \
  -H "content-type: application/json" \
  -d '{
    "spec_id": "SPEC_ID",
    "proposed_content": "# API\n\nUpdated contract.",
    "version_delta": "minor",
    "proposed_by": "alice",
    "summary": "Add integration contract"
  }'
```

Approve a review:

```sh
curl -X POST http://localhost:4000/api/v1/reviews/CHANGE_REQUEST_ID/approve \
  -H "content-type: application/json" \
  -d '{"reviewed_by":"reviewer-1"}'
```

When auth is required, sign in and pass the token:

```sh
TOKEN=$(
  curl -s -X POST http://localhost:4000/api/v1/auth/login \
    -H "content-type: application/json" \
    -d '{"username":"admin","password":"change-this"}' |
    node -e "let s=''; process.stdin.on('data', d => s += d); process.stdin.on('end', () => console.log(JSON.parse(s).token));"
)

curl http://localhost:4000/api/v1/auth/me -H "authorization: Bearer $TOKEN"
```

Create a long-lived API key for CLI, CI, or MCP automation:

```sh
curl -X POST http://localhost:4000/api/v1/auth/users \
  -H "authorization: Bearer $TOKEN" \
  -H "content-type: application/json" \
  -d '{"username":"agent-bot","role":"agent"}'

curl -X POST http://localhost:4000/api/v1/auth/api-keys \
  -H "authorization: Bearer $TOKEN" \
  -H "content-type: application/json" \
  -d '{"username":"agent-bot","name":"repo automation"}'
```

## Route Catalog

```
GET  /api/v1/project-types              POST /api/v1/project-types
GET  /api/v1/projects                   POST /api/v1/projects
GET  /api/v1/specs                      POST /api/v1/specs
GET  /api/v1/specs/:id                  PUT  /api/v1/specs/:id          (drafts only)
GET  /api/v1/specs/:id/impact?delta=patch|minor|major
POST /api/v1/specs/assist-draft
POST /api/v1/specs/:id/assist
POST /api/v1/specs/:id/publish          GET  /api/v1/specs/:type/download   (zip)
POST /api/v1/specs/review               GET  /api/v1/reviews[?status=]
GET  /api/v1/reviews/sla
GET  /api/v1/reviews/:id/publish-preview
POST /api/v1/reviews/:id/approve        POST /api/v1/reviews/:id/reject
GET  /api/v1/ai/specs/:projectType      POST /api/v1/ai/feedback
POST /api/v1/ai/resolve-guidance
GET  /api/v1/ai/feedback[?status=]      POST /api/v1/ai/feedback/:id/status
GET  /api/v1/ai/feedback/clusters       POST /api/v1/ai/feedback/:id/draft-fix
POST /api/v1/ai/feedback/clusters/status   POST /api/v1/ai/feedback/clusters/draft-fix
GET  /api/v1/ai/search?q=[&mode=fts|semantic|hybrid&project_type=&repo=]  GET /api/v1/ai/mcp-guide/:type
POST /api/v1/ai/audit                   POST /api/v1/ai/efficacy
GET  /api/v1/ai/efficacy/trends         POST /api/v1/ai/efficacy/scheduled-run
POST /api/v1/ai/regression-suite        GET /api/v1/ai/token-roi
POST /api/v1/specs/:id/promote          GET  /api/v1/specs/:type/compile?target=
GET  /api/v1/specs/:type/agent-pack     GET/POST/DELETE /api/v1/approval-policies
GET  /api/v1/spec-ownership             GET /api/v1/specs/dependency-map
GET  /api/v1/spec-purposes              POST /api/v1/spec-gaps
POST /api/v1/spec-generation/preview    POST /api/v1/spec-generation/draft
GET  /api/v1/automation/features        POST /api/v1/automation/task-plan
GET  /api/v1/features/config            GET /api/v1/features/harness-insights
POST /api/v1/features/harness-insights/:key/proposal
GET  /api/v1/features/harness-proposals POST /api/v1/features/harness-insights/:key/proposals
POST /api/v1/features/harness-proposals/:id/validate
POST /api/v1/features/harness-proposals/:id/approve|reject
POST /api/v1/automation/ticket          POST /api/v1/automation/section-classifier
POST /api/v1/automation/context-budget  POST /api/v1/automation/audit-prompt
POST /api/v1/cli/code-trace-report      GET /api/v1/reports/overview
GET  /api/v1/automation/audit-prompt/:specId   GET /api/v1/automation/audit-prompts
POST /api/v1/automation/improvement-suggestions   POST /api/v1/automation/spec-pack
GET  /api/v1/specs/:type/download[?channel=beta]   GET /api/v1/meta/public-key
POST /api/v1/cli/stub-prompts           POST /api/v1/cli/sync-check
POST /api/v1/cli/manifest-diagnostics
GET/POST/PUT/DELETE /api/v1/templates   GET/POST/DELETE /api/v1/webhooks
GET/POST/DELETE /api/v1/subscriptions   GET /api/v1/sync-jobs · POST /api/v1/sync-jobs/run
GET  /api/v1/analytics/summary          GET /api/v1/reports/overview
POST /api/v1/auth/login                 GET /api/v1/auth/me
GET/POST /api/v1/auth/users             GET/POST/DELETE /api/v1/auth/api-keys
GET/PUT /api/v1/ldap/config             POST /api/v1/ldap/test · POST /api/v1/ldap/role-preview
GET  /api/v1/audit-log
GET/PUT /api/v1/llm/config             POST /api/v1/llm/test
GET  /api/v1/llm/tiering               PUT /api/v1/llm/tiering/tier/:tier
PUT  /api/v1/llm/tiering/routes        GET /api/v1/llm/models/:tier
GET/PUT /api/v1/embeddings/config      GET/POST /api/v1/embeddings/status|reindex
POST /api/v1/integrations/github/webhook   POST /api/v1/integrations/slack/actions
GET  /api/v1/meta/version               POST /api/v1/admin/update
GET  /metrics
```

## Authentication & roles

Auth is **off by default** (anonymous access, free-text author names) for the zero-config
dev experience. Set `SPECREG_AUTH=required` to require a Bearer token / `x-api-key` on every
non-public route. A local `admin` account is seeded (password from `SPECREG_ADMIN_PASSWORD`,
default `admin` in dev). Roles: `admin` > `reviewer` > `author` > `agent`; approvals need
`reviewer`, settings need `admin`. Per-project-type required reviewers restrict who can approve;
approval policies can also require N recorded approvals before a change publishes.

### Secured deployments (recommended for any real/shared use)

Run with `SPECREG_AUTH=required`. In this mode the server **refuses to boot while the `admin`
account still uses the default password `admin`** — set `SPECREG_ADMIN_PASSWORD` to your own, or
on a fresh database leave it unset and SpecRegistry generates a strong password and prints it
once at first start. This closes the "agent escalates to `admin`/`admin` and self-approves" path:
agents authenticate with their own enrolled `agent`-scoped token (issued by `specreg init` into
`.spec/credentials.json`), which can submit drafts and project-scoped specs but cannot approve,
publish, or reach admin routes. Combined with separation of duties (you cannot approve a change
you proposed), the governance is enforced server-side, not merely advised. See
[security reference](../README-SECURITY.md) for exactly which controls are server-enforced versus
advisory, and a deployment hardening checklist.

Set `LDAP_URL` to authenticate against a directory instead (direct-bind via
`LDAP_BIND_DN_TEMPLATE`, or service-account search via `LDAP_SEARCH_BASE`/`LDAP_SEARCH_FILTER`);
map roles with `LDAP_ADMIN_GROUP` / `LDAP_REVIEWER_GROUP`.

Set `SPECREG_SECRET_KEY` to encrypt secrets saved to the database (LDAP bind password, GitHub
token, webhook/Slack signing secrets, LLM/embedding API keys) at rest, instead of the default
plaintext storage. The key must come from outside the database (an env var, ideally sourced from
a secrets manager) so a stolen/leaked SQLite file alone does not also hand over the decryption
key. Values saved before the key was set keep working as plaintext; new saves encrypt
automatically once it is configured.

Secured deployments also get failed login/enrollment throttling and a restricted CORS default.
Set `SPECREG_CORS_ORIGINS` to the browser origins that may call the API directly. Login session
tokens expire after `SPECREG_LOGIN_TOKEN_TTL_HOURS` (default 24); long-lived API and agent tokens
remain non-expiring unless `SPECREG_API_TOKEN_TTL_DAYS` or `SPECREG_AGENT_TOKEN_TTL_DAYS` is set.
Admins can revoke individual API keys or bulk-revoke all tokens for a user.
