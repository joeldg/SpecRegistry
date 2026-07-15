# Operations

## Observability Usage

Scrape Prometheus metrics:

```sh
curl http://localhost:4000/metrics
```

Useful metrics include:

- `specregistry_specs_total`
- `specregistry_reviews_total`
- `specregistry_oldest_pending_review_age_seconds`
- `specregistry_feedback_total`
- `specregistry_usage_events_total`
- `specregistry_audit_events_total`
- `specregistry_efficacy_runs_total`

See [metrics reference](../README-METRICS.md) for where and how each metric is generated.

Run Grafana Alloy through Compose:

```sh
docker compose --profile metrics up --build
```

## Backup and Restore

The registry is a single SQLite database, so backups are consistent point-in-time
snapshots. Set `SPECREG_BACKUP_DIR` to turn on the **built-in scheduler**: the server
writes a snapshot (using SQLite's online backup, safe while running) plus a `.sha256`
sidecar every `SPECREG_BACKUP_INTERVAL` seconds and keeps the newest `SPECREG_BACKUP_KEEP`.

Admins can also trigger and list backups over the API:

```sh
curl -X POST -H "authorization: Bearer $ADMIN_TOKEN" http://localhost:4000/api/v1/admin/backup
curl -H "authorization: Bearer $ADMIN_TOKEN" http://localhost:4000/api/v1/admin/backups
```

Or use the ops CLI (honors `SPECREG_DB`, `SPECREG_BACKUP_DIR`, `SPECREG_BACKUP_KEEP`):

```sh
npm run backup -w @specregistry/server -- now              # take a snapshot now
npm run backup -w @specregistry/server -- list             # list snapshots + checksums
npm run backup -w @specregistry/server -- verify <file>    # checksum + PRAGMA integrity_check
npm run backup -w @specregistry/server -- restore <file>   # restore (run with the server stopped)
```

Restore verifies the snapshot (checksum + integrity), replaces the database file, and
clears any stale WAL/SHM sidecars. Because the ed25519 signing key lives in the database,
a restored server keeps the **same registry identity** — governed repos keep trusting it,
and signed bundles stay verifiable.

## Integration Usage

Use webhooks and chat integrations to push SDD events into the places teams already work:

- JSON webhooks for publish, review, and feedback events.
- Slack-formatted webhooks for review visibility.
- Slack interactive approve/reject actions with a Slack signing secret.
- Google Chat-formatted webhook payloads.
- GitHub repo subscriptions that open pull requests when approved specs change.
- HMAC-verified inbound GitHub push webhooks that convert repo-side spec edits into reviews.

GitHub and Slack app keys can be configured on the Settings page or with environment variables.
Saved values are never returned to the browser; Settings only shows whether each key is present.

## Authentication, Roles, and LDAP Usage

Auth is off by default for a zero-config local experience. Enable it for shared servers:

```dotenv
SPECREG_AUTH=required
SPECREG_ADMIN_PASSWORD=change-this
```

Roles are `admin`, `reviewer`, `author`, and `agent`. Admins manage settings, reviewers
approve governed changes, authors create drafts and change requests, and agents can be
given scoped API keys for automation.

For LDAP, configure the Settings page or environment variables such as:

```dotenv
LDAP_URL=ldaps://ldap.example.com
LDAP_BIND_DN_TEMPLATE=uid={{username}},ou=people,dc=example,dc=com
LDAP_ADMIN_GROUP=SpecRegistry Admins
LDAP_REVIEWER_GROUP=SpecRegistry Reviewers
LDAP_DEFAULT_ROLE=author
```

Use the LDAP tester in Settings before switching users over.

## Server environment variables

| Variable | Enables |
| --- | --- |
| `PORT`, `SPECREG_DB` | Listen port (4000) and SQLite path |
| `SPECREG_PUBLIC_URL` | Externally reachable URL used in agent packs and MCP guides; overrides the Settings public hostname |
| `SPECREG_AUTH=required` | Require auth on all non-public routes |
| `SPECREG_ADMIN_PASSWORD` | Seeded admin password (default `admin`) |
| `SPECREG_CORS_ORIGINS` | Comma-separated browser origins allowed to call the API; secured mode defaults to same-origin plus local dev origins |
| `SPECREG_LOGIN_TOKEN_TTL_HOURS` | Login session TTL in hours (default 24) |
| `SPECREG_API_TOKEN_TTL_DAYS` / `SPECREG_AGENT_TOKEN_TTL_DAYS` | Optional TTLs for API keys and enrolled agent tokens; unset means long-lived until revoked |
| `SPECREG_AUTH_RATE_LIMIT_MAX` | Failed login/enroll attempts allowed per identity/window (default 5) |
| `SPECREG_AUTH_RATE_LIMIT_WINDOW_SECONDS` / `SPECREG_AUTH_RATE_LIMIT_LOCK_SECONDS` | Rate-limit counting window and lockout duration (defaults 900 seconds) |
| `SPECREG_SELF_UPDATE` | Enable the in-app `git pull` + rebuild self-update (`POST /admin/update`). Defaults on in dev, **off when `SPECREG_AUTH=required`**; set `true`/`false` to override |
| `SPECREG_BACKUP_DIR` | Directory for scheduled registry backups; set to enable the built-in scheduler and `POST /admin/backup` |
| `SPECREG_BACKUP_INTERVAL` | Seconds between scheduled backups (default 86400) |
| `SPECREG_BACKUP_KEEP` | Number of recent backups to retain (default 14) |
| `ANTHROPIC_API_KEY` | Anthropic key fallback for server LLM features |
| `OPENAI_API_KEY` | OpenAI key fallback for server LLM features |
| `GEMINI_API_KEY` / `GOOGLE_API_KEY` | Gemini key fallback for server LLM features |
| `OPENROUTER_API_KEY`, `BITDEER_API_KEY`, `TOGETHER_API_KEY`, `VULTR_API_KEY`, `NVIDIA_API_KEY` / `NGC_API_KEY` | Hosted OpenAI-compatible provider key fallbacks |
| `LLM_PROVIDER` | Server LLM provider: `anthropic`, `openai`, `gemini`, `openrouter`, `bitdeer`, `together`, `vultr`, `nvidia`, or `openai_compatible` |
| `LLM_MODEL` | Server LLM model name |
| `LLM_BASE_URL` | Anthropic proxy or OpenAI-compatible local/network endpoint |
| `LLM_API_KEY` | Server LLM API key; optional for some local endpoints |
| `LLM_MAX_TOKENS` | Default server LLM token budget |
| `LLM_LOCAL_BASE_URL` / `LLM_CHEAP_BASE_URL` | Default cheap-tier local/network OpenAI-compatible endpoint |
| `LLM_LOCAL_MODEL` / `LLM_CHEAP_MODEL` | Default cheap-tier model |
| `LLM_CHEAP_API_KEY`, `LLM_CHEAP_MAX_TOKENS` | Optional cheap-tier API key and token budget |
| `LLM_FRONTIER_MODEL`, `LLM_FRONTIER_MAX_TOKENS` | Optional frontier-tier model and token budget overrides |
| `EMBEDDING_PROVIDER` | Semantic search provider: `local_hash`, `openai`, `gemini`, or `openai_compatible` |
| `EMBEDDING_MODEL` | Embedding model name |
| `EMBEDDING_BASE_URL` | OpenAI-compatible local/network embedding endpoint or hosted proxy |
| `EMBEDDING_API_KEY` | Embedding provider API key; optional for local endpoints |
| `EMBEDDING_DIMENSIONS` | Local deterministic embedding dimensions (default 128) |
| `SPECREG_AUTOMATION_ENABLED` | Master flag for automation APIs and workbench controls |
| `SPECREG_AUTOMATION_GAP_DETECTION` | Enable spec gap detection |
| `SPECREG_AUTOMATION_GENERATION` | Enable spec generation preview/draft creation |
| `SPECREG_AUTOMATION_QUALITY_MODELS` | Enable QUALITY.md rubric generation and evaluation handoff workflows |
| `SPECREG_AUTOMATION_LLM_GENERATION` | Enable requested LLM-backed automation variants |
| `SPECREG_AUTOMATION_TASK_PLANNER` | Enable task planning |
| `SPECREG_AUTOMATION_TICKET_GENERATOR` | Enable PR/ticket checklist generation |
| `SPECREG_AUTOMATION_MAINTENANCE` | Enable improvement suggestions |
| `SPECREG_AUTOMATION_PACK_COMPOSER` | Enable spec pack composition |
| `SPECREG_AUTOMATION_AUDIT_PROMPTS` | Enable generated audit prompts |
| `SPECREG_AUTOMATION_SECTION_CLASSIFIER` | Enable section classification |
| `SPECREG_AUTOMATION_CONTEXT_OPTIMIZER` | Enable context budget optimization |
| `SPECREG_CODE_METADATA_ENABLED` | Master default for code metadata and traceability features |
| `SPECREG_CODE_METADATA_TYPESCRIPT_JAVASCRIPT` | Enable TypeScript/JavaScript extraction defaults |
| `SPECREG_CODE_METADATA_PYTHON` | Enable Python extraction defaults |
| `SPECREG_CODE_METADATA_SQL` | Enable SQL extraction defaults |
| `SPECREG_CODE_METADATA_ROUTE_DETECTION` | Enable route metadata extraction defaults |
| `SPECREG_CODE_METADATA_SCHEMA_DETECTION` | Enable schema metadata extraction defaults |
| `SPECREG_CODE_METADATA_INLINE` | Default for optional inline metadata injection (default off) |
| `SPECREG_HARNESS_IMPROVEMENT_ENABLED` | Enable experimental harness improvement controls (default off) |
| `SPECREG_HARNESS_IMPROVEMENT_FAILURE_PATTERN_MINING` | Enable mining agent sessions, feedback, and compliance evidence for harness weaknesses |
| `SPECREG_HARNESS_IMPROVEMENT_PROPOSAL_DRAFTING` | Enable preview-only governed harness proposal drafting (default off) |
| `SPECREG_HARNESS_IMPROVEMENT_REGRESSION_VALIDATION` | Enable deterministic approval gates for harness proposals |
| `SPECREG_HARNESS_IMPROVEMENT_REVIEW_PROMOTION` | Keep harness proposals routed through review-gated promotion |
| `GITHUB_TOKEN` | Git push-back PRs + inbound webhook file fetch; fallback if not saved in Settings |
| `GITHUB_WEBHOOK_SECRET` | Verify inbound GitHub push webhooks; fallback if not saved in Settings |
| `SLACK_SIGNING_SECRET` | Verify Slack interactive approve/reject actions; fallback if not saved in Settings |
| `LDAP_URL` (+ `LDAP_*`) | Optional LDAP authentication |
| `SPECREG_SECRET_KEY` | Encrypts secrets saved to the database at rest (LDAP bind password, GitHub token, webhook/Slack signing secrets, LLM/embedding API keys). Unset means those settings are stored in plaintext, as before. |
| `SPECREG_REPO_DIR` | Overrides the git checkout directory used for `/api/v1/meta/version` and `/api/v1/admin/update`, for process managers that launch the server with a cwd outside the repo. Defaults to auto-discovering the checkout via `git rev-parse --show-toplevel`. |
| `SPECREG_GITHUB_REPO` | Overrides the `owner/repo` used for the GitHub version-drift check, for deployments where `git remote get-url origin` isn't a `github.com` URL. Auto-detected from the origin remote otherwise. |
| `SPECREG_UPDATE_TIMEOUT_MS` | Per-command timeout for the `git pull` / `npm install` / `npm run build` steps run by `POST /api/v1/admin/update` (default 180000). |

## Client environment variables

| Variable | Used by |
| --- | --- |
| `SPECREG_SERVER` | CLI, MCP, and sample loader registry URL |
| `SPECREG_TOKEN` | CLI, MCP, and sample loader Bearer/API token for auth-required registries |
| `SPECREG_PROJECT_TYPE` | MCP default project type |
| `SPECREG_GENERATE_PROVIDER` | CLI `specreg generate --write` provider: `anthropic`, `openai`, `gemini`, or `openai_compatible` |
| `SPECREG_GENERATE_MODEL` | CLI generation model override |
| `SPECREG_GENERATE_BASE_URL` | CLI generation base URL for proxy/local/OpenAI-compatible endpoints |
| `SPECREG_GENERATE_API_KEY` | CLI generation API key override |
| `SPECREG_GENERATE_MAX_TOKENS` | CLI generation token budget |

`specreg generate --write` also reads `.env` in the current directory. If
`SPECREG_GENERATE_*` variables are omitted, it falls back to the matching server-style
`LLM_PROVIDER`, `LLM_MODEL`, `LLM_BASE_URL`, `LLM_API_KEY`, and provider API key variables
such as `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, and `GEMINI_API_KEY`.

CLI generation examples:

```dotenv
SPECREG_GENERATE_PROVIDER=openai
SPECREG_GENERATE_MODEL=gpt-4.1
OPENAI_API_KEY=sk-...
```

```dotenv
SPECREG_GENERATE_PROVIDER=gemini
SPECREG_GENERATE_MODEL=gemini-3.5-flash
GEMINI_API_KEY=...
```

```dotenv
SPECREG_GENERATE_PROVIDER=openai_compatible
SPECREG_GENERATE_MODEL=llama3.1
SPECREG_GENERATE_BASE_URL=http://localhost:11434/v1
```

## Server LLM providers

Server-side LLM features include AI draft-fix, reverse conformance audit, spec efficacy,
and LLM-backed automation. Configure them on the Settings page or with environment
variables.

The Settings page uses three configurable tiers:

- **Cheap / local**: default for classification, summarization, and task planning.
- **Standard**: default for ticket generation, maintenance suggestions, and connectivity tests.
- **Frontier**: default for spec generation, final audits, AI draft fixes, and efficacy scoring.

Each tier can use a different provider, model, base URL, API key, and max-token budget.
The provider catalog includes Anthropic, OpenAI, Gemini, OpenRouter, Bitdeer, Together AI,
Vultr, NVIDIA NIM/build.nvidia.com, and custom OpenAI-compatible endpoints. The routing
table lets admins remap each feature to `cheap`, `standard`, or `frontier` without
changing code. The older `/api/v1/llm/config` endpoint still configures the standard tier
for compatibility.

Anthropic example:

```dotenv
LLM_PROVIDER=anthropic
LLM_MODEL=claude-opus-4-8
ANTHROPIC_API_KEY=sk-ant-...
```

OpenAI example:

```dotenv
LLM_PROVIDER=openai
LLM_MODEL=gpt-4.1
OPENAI_API_KEY=sk-...
```

Gemini example:

```dotenv
LLM_PROVIDER=gemini
LLM_MODEL=gemini-3.5-flash
GEMINI_API_KEY=...
```

Local or network OpenAI-compatible example:

```dotenv
LLM_PROVIDER=openai_compatible
LLM_MODEL=llama3.1
LLM_BASE_URL=http://ollama.internal:11434/v1
LLM_API_KEY=
```

Hosted OpenAI-compatible providers use the same chat-completions path with provider
defaults for base URLs and model fallbacks:

```dotenv
LLM_PROVIDER=openrouter
OPENROUTER_API_KEY=sk-or-...
LLM_MODEL=anthropic/claude-sonnet-4.5
```

NVIDIA NIM/build.nvidia.com example:

```dotenv
LLM_PROVIDER=nvidia
NVIDIA_API_KEY=nvapi-...
LLM_MODEL=nvidia/llama-3.3-nemotron-super-49b-v1.5
```

Cheap-tier local model with a hosted frontier model:

```dotenv
LLM_PROVIDER=anthropic
LLM_MODEL=claude-sonnet-4-5
ANTHROPIC_API_KEY=sk-ant-...
LLM_LOCAL_BASE_URL=http://host.docker.internal:1234
LLM_LOCAL_MODEL=google/gemma-4-12b-qat
LLM_CHEAP_MAX_TOKENS=4000
LLM_FRONTIER_MODEL=claude-opus-4-8
```

From Docker Compose on macOS/Windows, use `host.docker.internal` to reach a model server
running on the host:

```dotenv
LLM_PROVIDER=openai_compatible
LLM_MODEL=llama3.1
LLM_BASE_URL=http://host.docker.internal:11434/v1
```

OpenAI-compatible mode works with services such as Ollama, LM Studio, vLLM, LocalAI, or an
internal gateway that exposes `/chat/completions`.
For LM Studio, either `http://host:1234` or `http://host:1234/v1` is accepted; root
OpenAI-compatible URLs are normalized to `/v1` automatically for model loading and chat
tests.
The Settings page can query available models from Anthropic, OpenAI, Gemini, and
OpenAI-compatible providers that expose `/models`; if a provider cannot list models yet,
SpecRegistry shows provider-specific fallbacks so tiers can still be configured.

Spec download bundles are ed25519-signed; the keypair is generated on first use and stored
in the database. `specreg verify` checks bundle provenance against the public key.

## Automation feature flags

Automation APIs are enabled by default. Set any flag to `false`, `0`, `off`, or `no` to
disable that capability for a deployment. The Generate Specs workbench reads
`GET /api/v1/automation/features` and disables controls for unavailable features.
Admins can also manage these flags on **Settings -> Features**. Saved settings are stored
in the registry database and override environment defaults.

Harness improvement flags live in the same Settings section. They are off by default.
Failure-pattern mining and proposal drafting are deterministic. Drafted proposals become
pending harness reviews and only update governed skills after explicit approval and passing
regression validation.

LLM-backed automation only runs when both conditions are true:

1. `SPECREG_AUTOMATION_LLM_GENERATION` is enabled.
2. The request explicitly asks for LLM use, such as the workbench **Use server LLM** toggle.

Without LLM mode, automation endpoints use deterministic templates, spec metadata, repo
evidence, and existing registry telemetry. This keeps CI/server deployments usable even when
no model provider is configured.

The same Settings screen also exposes code metadata and AST traceability controls. Current
available toggles cover `specreg code-map` style extraction for TypeScript/JavaScript,
Python, SQL, routes, schemas, stable IDs, and sidecar metadata. Planned toggles are visible
for inline metadata injection, traceability graphs, semantic drift, code embeddings, and
code-to-spec coverage reports so deployments can decide which features should be allowed as
those slices are implemented.

## Troubleshooting

- **CLI command not found**: run `npm run build`, then `npm link -w @specregistry/cli -w @specregistry/mcp`,
  or invoke `node packages/cli/dist/index.js ...` directly.
- **Agents cannot reach the registry in Docker**: set `SPECREG_PUBLIC_URL`, or set the public
  hostname in Settings > Integrations > Server reachability, to the URL reachable from
  developer machines and agent environments.
- **Auth-required CLI/MCP calls fail**: pass `--token <token>` or set `SPECREG_TOKEN`.
- **LLM features say a key is missing**: configure the provider on Settings or set the matching
  `LLM_*` / provider API key environment variables.
- **Local model server is on the host while SpecRegistry runs in Docker**: use
  `http://host.docker.internal:<port>/v1` as `LLM_BASE_URL` on macOS/Windows.
- **Generated specs conflict with governed files**: keep generated drafts outside `specs/`
  until `specreg submit-drafts` sends them through the registry workflow.
