# Concepts

- **Hierarchy** — project types are reusable baselines, not individual projects. A seeded `scope=global` type holds
  organization-wide specs; every download/agent query bundles global + type specs.
  The built-in SpecRegistry Operating Baseline is the default global SDD process pack.
  The Acme types are demo seed data; additional built-in starter types include MCP Server
  / Agent Integration, SaaS Backend API, CLI Tool / Developer Tooling, AI-SDD Governed
  Project, Data Platform / ETL Pipeline, Internal Admin Tool, and Mobile App.
- **Lifecycle** — new specs start as `0.1.0` drafts and are edited directly. Publishing
  makes them `1.0.0`. Published specs only change through a change request
  (`POST /api/v1/specs/review`): the server stores a unified diff, the spec enters
  `pending_review`, and approval bumps the semver by the requested delta
  (major/minor/patch) and records an immutable version snapshot. Admins can soft-delete
  specs; deleted specs are hidden from governed reads, downloads, search, reports, and
  automation while being retained for 14 days. The filename stays reserved during
  retention so admins can restore the exact governed artifact without ambiguity.
- **AI feedback loop** — agents read `GET /api/v1/ai/specs/:projectType` and report
  spec ambiguities/contradictions to `POST /api/v1/ai/feedback`, which appear as
  alerts on the dashboard and on the affected spec until triaged. Repeated complaints
  are clustered by spec/type/text at `GET /api/v1/ai/feedback/clusters`; clusters can be
  acknowledged, resolved, or drafted as one change request. From any feedback item,
  **Draft AI fix** sends the spec + complaint to the configured server LLM and opens the revision as a normal
  pending change request — the review workflow stays the safety gate.
- **Templates & conformance lint** — per-filename templates define required sections;
  every change request is linted against them and new drafts scaffold from the
  template body. Lint also checks for missing examples, missing non-goals, missing
  operational sections, and ambiguity terms. Lint results and a heading-based
  **compatibility report** (removed sections ⇒ major, added ⇒ minor) are stored on
  the change request and shown in review.
- **Contradiction checks** — change requests also store a deterministic cross-spec
  contradiction report. Proposed normative statements are compared with published global
  and project-type specs so reviewers can see possible conflicts before approval.
- **Governance previews** — change requests carry a risk score for compatibility,
  security/privacy sensitivity, contradictions, and lint failures. Review detail includes
  a dry-run publish preview showing affected repos, generated agent files, webhooks, and
  sync jobs before approval. The preview also includes impact analysis: affected manifest
  consumers, subscribed repos, downstream spec references, open feedback, recent usage,
  and an impact score/level. It also generates a downstream migration checklist and
  PR-ready summary/changelog for spec update pull requests. Approval policies double as
  CODEOWNERS-style spec ownership and are exposed through `GET /api/v1/spec-ownership`.
- **Distribution** — `specreg check` gates CI on spec drift; repo subscriptions open
  GitHub PRs with updated specs on approval (configure a GitHub token in Settings or set `GITHUB_TOKEN`);
  webhooks (JSON or Slack format) fire on publish/review/feedback events.
- **Project-scoped specs** — repo projects are first-class consumers attached to a
  project type. Global specs define the shared baseline, project-type specs define the
  domain baseline, and project specs override only that repo when local behavior needs
  governed guidance without changing every consumer of the type. If a spec names one repo,
  one deployment, one customer, or one product instance, it usually belongs on the project,
  not on the baseline.
- **Search & analytics** — `GET /api/v1/ai/search?q=&mode=fts|semantic|hybrid` serves
  section-level FTS5, embedding, or combined search hits to agents and the Search page;
  usage events (pulls, agent reads, searches, drift checks) roll up on the dashboard,
  including stale-but-published spec detection. Search and agent spec responses include
  stable section anchors/permalinks for exact citations.
- **Granular reports** — the Reports page and `GET /api/v1/reports/overview` break SDD
  health down by global specs, project types, and individual projects, with scope mix,
  feedback mix, review risk, stale specs, efficacy outcomes, and project drift counts.
  Reports also show dependency-map, token-ROI panels, and a manifest diagnostics tool for
  pasting a `.specregistry.json` to compare local spec versions against the registry.
  The page also includes an AI reporting test bench for synthetic feedback plus audit
  and efficacy smoke tests against the configured LLM provider.
- **Impact explorer** — the Impact page and `GET /api/v1/specs/:id/impact?delta=` expose
  the same blast-radius model outside the review flow, including consumers, dependencies,
  migration checklist items, and generated PR summary markdown.
- **LLM spec automation** — the Generate Specs workbench detects missing governance specs
  from repo evidence, uses purpose-based templates for common spec types (API contracts,
  database schemas, test strategies, observability, security/privacy, agent operating
  rules, deployment runbooks, and quality models), generates prompts or server-LLM drafts,
  and creates reviewed registry drafts rather than publishing directly. It also provides
  task planning, spec-aware PR/ticket checklists, generated audit prompts, editor-side
  guidance for example specs and rewrites, section
  classification, context budget optimization, improvement suggestions, and spec pack
  composition. Automation features are individually flaggable, and LLM-backed variants
  run only when requested and enabled.
- **QUALITY.md quality models** — the `quality-model` purpose generates a spec-compliant
  [QUALITY.md](https://getquality.md/specification) quality rubric (YAML frontmatter with
  a rating scale, factors, and assessable requirements) through the normal draft/review/
  publish pipeline, so a portable, tool-agnostic quality model becomes a versioned,
  reviewed governed artifact instead of a loose local file. The built-in
  `evaluate-quality-model` agent skill bridges to the external `qualitymd` CLI / `/quality`
  agent skill for the actual evaluation loop — SpecRegistry governs the rubric's content
  and review history, it does not reimplement QUALITY.md's evaluation methodology.
  [examples/QUALITY.md](examples/QUALITY.md) is a worked, filled-in quality model
  for SpecRegistry itself (validated with `qualitymd lint`) that you can copy as a starting
  point.
- **Harness improvement controls** — Settings -> Features includes an experimental
  Self-Harness-style control group. When enabled, `GET /api/v1/features/harness-insights`
  mines agent sessions, feedback, and compliance attestations for recurring harness-level
  weaknesses. Proposal drafting can return preview-only governed skill updates while keeping
  promotion review-gated through pending harness proposals that must be approved before
  they update any governed skill. Regression validation runs deterministic skill-rendering,
  safety-boundary, bounded-edit, and pattern-specific gates before approval.
- **Review SLA** — `GET /api/v1/reviews/sla` summarizes pending review age, warnings,
  breached reviews, and remaining approvals. The dashboard surfaces the oldest pending
  review and breached/warning counts.
- **Prometheus metrics** — `GET /metrics` exposes SDD and runtime governance metrics
  including spec counts, review states, feedback, usage events, sync jobs, users,
  approval policies, audit events, and efficacy runs. Docker Compose includes an
  optional Grafana Alloy profile for remote write.
- **Spec compiler** — `GET /api/v1/specs/:type/compile?target=claude|agents|cursor`
  renders the governed global + type spec set into the file agents actually load
  (`CLAUDE.md` / `AGENTS.md` / `.cursorrules`). `specreg sync` regenerates any target
  the repo has compiled, so the registry is the single source that produces agent context.
- **Agent onboarding packs** — `GET /api/v1/specs/:type/agent-pack` returns a zip with
  `CLAUDE.md`, `AGENTS.md`, `.cursorrules`, `.mcp.json`, and `SPECREGISTRY_MCP_SKILL.md`.
  `GET /api/v1/ai/mcp-guide/:type` exposes the MCP skill guide directly for agent setup.
  Generated MCP configs use `specreg mcp`, and `specreg init` writes a root `AGENTS.md`
  bootstrap so agents know to read `SPECREGISTRY.md`, load governed skills, call MCP
  `get_specs`, and run the compliance loop before claiming completion.
- **Projects** — local manifests reported by `specreg init`, `specreg check`, `specreg sync`,
  and `specreg submit-drafts` let the Settings page show which repositories are using which
  spec set, how many reported specs are behind the latest approved versions, and which
  repo-specific specs exist as project overrides.
- **Reverse conformance audit** — `POST /api/v1/ai/audit` (and `specreg audit`) asks
  the configured server LLM whether a codebase snapshot *follows* its governed specs,
  reporting violations with spec/section/file citations. Checks adherence, not just spec currency.
- **Spec efficacy testing** — `POST /api/v1/ai/efficacy` runs a task with and without
  the spec in context and grades both, measuring whether a spec actually changes agent
  output ("earns its tokens" vs "no lift"). Trend, scheduled-run, prompt-regression,
  and token-ROI endpoints provide the reporting surface for model/spec comparisons.
- **Auth, roles & review routing** — local accounts (scrypt) or optional LDAP; roles
  (admin/reviewer/author/agent) gate approvals and settings; per-project-type required
  reviewers (CODEOWNERS-style). Approval policies can require multiple reviewers by
  project type and filename glob. Bearer tokens / `x-api-key` for agents and CI.
- **Audit log** — governance-sensitive actions (login, user/API-key changes, LDAP/settings
  changes, review submission/approval/rejection/publish, templates, webhooks, subscriptions,
  and sync-job runs) are recorded in `audit_log` and surfaced at `GET /api/v1/audit-log`.
- **Channels & semver ranges** — approve to a `beta` channel without touching the stable
  head, then promote; manifests can carry caret pins (`^1.0.0`) and `sync-check` reports
  drift severity and whether the latest is within the pin.
- **Signed bundles** — download manifests carry per-file SHA-256 and an ed25519 signature;
  `specreg check` and `specreg verify` check provenance against `/api/v1/meta/public-key`
  before trusting local governed spec content.
- **Two-way git sync** — a subscribed repo editing `specs/*.md` (HMAC-verified GitHub push
  webhook) auto-opens a matching change request, closing the last drift hole.
- **Server self-update check** — `GET /api/v1/meta/version` (public, like `/health`) reports
  the running commit, whether the working tree is dirty, and compares against the GitHub
  branch it was cloned from. The dashboard shows a banner when the server is behind; admins
  get an **Update now** button that calls `POST /api/v1/admin/update` to run `git pull
  --ff-only` and rebuild. This only works for a deployment running from a live git checkout
  (the local/dev or production-style Node paths below) — it refuses on a dirty working tree
  or a non-fast-forward pull rather than guessing at a merge, and a Docker deployment has no
  `.git` directory to pull into, so redeploy a new image there instead. It also does not
  restart the process itself: Node cannot safely hot-swap its own already-loaded code, so a
  manual (or process-manager) restart is still required after the pull finishes.
- **Chat integrations** — webhooks in JSON, **Slack** (with interactive approve/reject
  buttons → `/api/v1/integrations/slack/actions`), or **Google Chat** format.
