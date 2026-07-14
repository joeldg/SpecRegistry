# SpecRegistry Add-On Backlog

## LLM Spec Automation

- [x] Spec gap detector that scans repo metadata and identifies missing governance specs.
- [x] Spec generation workbench for generating reviewed draft specs from repo scans, pasted trees, uploaded manifests, existing spec packs, or project type templates.
- [x] Purpose-based spec templates for API contracts, database schemas, test strategies, deployment/runbooks, observability, security/privacy, agent operating rules, and quality models.
- [x] QUALITY.md integration (https://getquality.md/specification): a `quality-model`
  purpose template generates a spec-compliant QUALITY.md (YAML frontmatter with
  ratingScale/factors/requirements, plus a governed AI Agent Directives section) through
  the normal draft/review/publish pipeline, so a portable, tool-agnostic quality rubric
  becomes a versioned governed artifact instead of a loose local file. A built-in
  `evaluate-quality-model` skill bridges to the external `qualitymd` CLI / `/quality`
  agent skill for the actual evaluation loop — SpecRegistry governs the rubric's content
  and review history, it does not reimplement QUALITY.md's evaluation methodology.
  A worked, filled-in reference model for SpecRegistry itself lives at
  `docs/examples/QUALITY.md`; both it and the generated purpose-template scaffold were
  validated against the real `qualitymd` v0.27.1 CLI (`qualitymd lint` clean, `model tree`
  parses). Follow-up if this proves valuable: parse the frontmatter natively and feed
  factors/requirements/ratingScale into the compliance-policy and audit-prompt machinery
  instead of treating it as opaque prose.
- [x] Agent task planner that returns applicable specs, sections, missing specs, and acceptance criteria for a ticket or task.
- [x] Spec-aware PR/ticket generator that produces implementation checklists from governing specs.
- [x] Spec improvement suggestions based on feedback clusters, weak efficacy, audit findings, and low token ROI.
- [x] Spec pack composer for reusable global and project-type packs such as AI-SDD, SaaS backend, embedded systems, web app, and data platform packs.
- [x] Generated audit prompts per spec for reverse conformance checks.
- [x] Spec editor LLM assist for guided example generation and rewrites that align with related published specs.
- [x] Spec section classifier for invariants, acceptance criteria, examples, non-goals, operational requirements, security requirements, and reference detail.
- [x] Context budget optimizer that selects the highest-value specs/sections for an agent task under a token budget.
- [x] Configurable LLM Tiering: Split LLM routing in settings to send simpler tasks (classification, simple linting, initial summarization) to a local/cheap LLM (e.g., Ollama, LM Studio) and complex tasks (spec generation, final audits, draft-fixes) to frontier/expensive models (Anthropic, OpenAI).

## Governance

- [x] Built-in SpecRegistry Operating Baseline global specs covering strict SDD process,
  agent behavior, spec authoring, governance, traceability/observability, tokenomics,
  implementation evidence, security/secrets, and project profiles.
- [x] First-class Projects UI/API so concrete repositories can own project-scoped specs
  without turning reusable project types into one-off project definitions.
- [x] Spec impact analysis before approval/publish, including affected manifest consumers,
  repo subscriptions, downstream spec references, feedback, recent usage, and risk level.
- [ ] LLM-assisted contradiction detection: current contradiction reports use deterministic
  normative-statement heuristics. Add an optional LLM/semantic pass that can catch
  paraphrased conflicts, policy collisions, and intent-level contradictions before review.
- [ ] First-class "spec followed but intent missed" workflow and report type for cases
  where implementation technically complies but the user or operational outcome is wrong.

## Agent Access Control

- [x] Agent session registry: persist active/completed agent runs by repo, project type,
  task, model, MCP server, loaded spec bundle, preflight summary, completion evidence,
  compliance attestation, and timestamps.
- [x] MCP preflight gate (`begin_task`): require agents to register task intent, repo,
  model, plan, and loaded specs before non-trivial implementation work; return blockers,
  warnings, and the governed spec bundle.
- [x] MCP completion gate (`finish_task`): record completion evidence, wrap the objective
  compliance evaluator, update the session, and block completion claims until the
  compliance gate passes.
- [x] Advisory agent access boundaries: `SPECREGISTRY.md` and the `AGENT_OPERATING_RULES`
  governed spec now constrain agents to the MCP server, the documented agent API
  (`begin_task`, `get_specs`, `search_specs`, `finish_task`, `report_spec_feedback`),
  and the `specreg` CLI — no dashboard browsing, endpoint probing, or server-internals
  inspection.
- [x] Enforced secured posture: with `SPECREG_AUTH=required` the server refuses to boot while
  `admin` uses the default password (also catches `SPECREG_ADMIN_PASSWORD=admin`), and a fresh
  secured database auto-generates a strong admin password printed once. Converts the agent
  MCP/API boundary, RBAC, and separation of duties from advisory to server-enforced; agents
  authenticate with their enrolled `agent`-scoped token and cannot approve/publish/admin.
- [ ] Governed tool permission profiles by project/spec/task, covering allowed file edits,
  shell/network/dependency/database actions, destructive commands, LLM usage, and
  escalation expectations for the host agent.
- [ ] Task-intent to spec mapping: require agents to declare applicable specs/sections and
  compare that declaration to registry guidance to detect missed governing specs.
- [ ] Human intervention queue for failed compliance, conflicting specs, missing guidance,
  or ambiguous task intent instead of letting agents guess through blockers.
- [ ] Agent run timeline: event stream for loaded specs, selected skills, searches,
  generated files, commands/checks run, compliance iterations, feedback submitted, and
  final claims.
- [ ] Prompt-budget policy controls for agents, including required/optional/summarized spec
  tiers, max prompt budgets by task class, and token warnings for low-value context.
- [ ] Model/provider policy controls for agent task classes, such as cheap/local for
  classification, frontier for governance audits, and local-only for private repos.
- [ ] Spec conflict escalation workflow where agents submit contradictory clauses,
  affected specs, implementation impact, and proposed resolution path.
- [ ] Hard agent access enforcement: issue a scoped `agent`-role token during `specreg init`
  and wire `SPECREG_AUTH=required` into the init/MCP flow so the MCP/API limitation is
  enforced at the network layer, not just advised. Anything beyond the agent-tier endpoints
  is then rejected with 401/403 rather than relying on agent cooperation.
- [ ] Dedicated agent-scope token type (narrower than the `agent` role) that allows only
  documented lifecycle/spec/feedback endpoints plus manifest/code-trace telemetry, with
  per-repo issuance and revocation from the admin console.
- [ ] Clarify and, if needed, enforce cross-repo spec **read** scope: `assertAgentScope`
  restricts agent-role **writes** (create/edit/publish) to the agent's own enrolled repo,
  but spec **reads** (`GET /ai/specs/:type?repo=`, `GET /specs?project_id=`) accept any
  `repo`/`project_id`, so an agent enrolled for repo A can currently read repo B's
  project-scoped specs by passing repo B's identifier. Likely intentional today (specs are
  governance docs, not secrets, and one registry usually serves one trusted org), but it
  should be a documented decision rather than an emergent property — revisit if
  multi-tenant/cross-org deployments are ever supported.

## Quality and Safety

- [ ] Persisted prompt regression suites: the `/ai/regression-suite` endpoint runs prompts
  on demand, but it does not yet store suites, baselines, expected outcomes, model/spec
  version comparisons, or pass/fail history in the UI.
- [ ] Scheduled efficacy runner: the current scheduled-run endpoint is an on-demand batch.
  Add real schedules with cadence, ownership, retries, last-run status, result history,
  and notifications.
- [ ] Architecture Boundary Violations Engine: Implement multi-language import graph checking (via dependency-cruiser for JS/TS, Import Linter for Python, and build-system/Bazel visibility rules or compiler checks for C++) alongside category-specific LLM auditing to detect and count layer boundary breaches in CI.
- [ ] Spec baseline quality scoring for required sections, vague language, missing
  acceptance evidence, missing examples/non-goals, token budget mismatch, and repeated
  feedback against the same section.
- [x] Bound the code-trace ingest payload explicitly: `raw_json` stores the whole untrusted
  trace (currently only capped by Fastify's default 1MB body limit). Add an explicit size
  cap / per-route body limit and dedupe the repeated `repo` reads in the handler.
- [x] Login/enroll rate limiting: `POST /api/v1/auth/login` and
  `POST /api/v1/agents/enroll` now throttle repeated failed attempts per client/identity
  with `SPECREG_AUTH_RATE_LIMIT_*` controls.
- [x] Token expiry and rotation controls: tokens now carry `expires_at`; login sessions
  default to a 24-hour TTL, API/agent token TTLs are opt-in, expired tokens are rejected,
  and admins can bulk-revoke a compromised user's tokens.
- [x] CORS allowlist: secured deployments can set `SPECREG_CORS_ORIGINS`, and secured
  mode no longer falls back to reflecting every Origin.
- [x] This repository now has its own `.github/workflows/ci.yml` running
  `npm run build` and `npm test` on PRs and pushes to `main`.
- [x] Gitignore generated/pulled init artifacts (`CLAUDE.md`, `SPECREGISTRY.md`, `specs/`,
  `.spec/`, `.mcp.json`) in consuming repos so demo/init output is not accidentally
  committed.

## Compliance Verification

- [x] Compliance verification loop: objective gate (`POST /ai/compliance-check`) on measured
  traceability coverage/drift/unmapped vs per-project-type policy, with recorded self-assessed
  score + over-claim flagging; `check_compliance` MCP tool, `specreg comply` (non-zero exit),
  attestation log, and an `AGENT_OPERATING_RULES` rule to loop until compliant.
- [x] Compliance dashboard panel: web UI view over `/api/v1/compliance-attestations` so humans
  can watch the self-healing loop per repo (iteration count, objective vs self-assessed score,
  latest outstanding items).
- [x] Per-project-type compliance policy editor on the Settings page (`GET/PUT
  /api/v1/compliance-policies`): set min coverage / max drift / required-mapped kinds from the
  UI instead of the API only.
- [x] Guard the vendored styleguide catalog against drift: `packages/cli/src/styleguideCatalog.ts`
  is a deliberate mirror of the `@specregistry/shared` catalog (vendored so the published CLI has
  no `@specregistry/shared` runtime dep). A mirror comment marks it and `styleguideCatalog.test.ts`
  asserts the two stay identical. (Full de-dup into one runtime source is still possible later.)
- [x] Scope agent-session listing: the agent-tier `GET /ai/agent-sessions` now requires a `repo`
  (no cross-repo enumeration of task text/plans/models); the global cross-repo view moved to the
  admin-gated `GET /api/v1/agent-sessions`.

## Token Usage Observability

The AI-SDD observability model requires tracing specification context to token usage at the
project, spec, and section level. SpecRegistry should distinguish **projected context tokens**
that the registry delivered or would deliver from **real LLM usage tokens** reported by agents,
MCP tools, or provider responses. Projected tokens explain context cost and prompt saturation;
real tokens explain actual model spend and efficiency.

- [x] Add context-token event storage for every governed context retrieval. Suggested tables:
  `context_events` for the retrieval/session envelope and `context_event_sections` for one
  row per delivered spec section.
- [x] Record context delivery from all registry-controlled paths: MCP `begin_task`,
  `get_specs`, `search_specs`, `resolve_guidance`, agent-facing `/ai/specs`, `/ai/search`,
  compiled context downloads, agent pack generation, and CLI `specreg compile` when it
  talks to the server.
- [x] For each delivered section, persist project identity, project type, repo/consumer,
  agent session id when available, event type, spec id, spec version, filename, section
  title, section anchor, character count, estimated token count, tokenizer/estimator name,
  task/query detail, actor, and timestamp.
- [x] Start with a deterministic approximate tokenizer (`ceil(chars / 4)`) and store the
  estimator version on every row. Add model-aware tokenizers later without rewriting old
  history.
- [x] Add real LLM usage reporting endpoint/table for agents and server-side LLM calls:
  provider, model, prompt tokens, completion tokens, total tokens, cached/input/output
  tokens when available, cost estimate, latency, request route, agent session id, and
  related context event ids.
- [x] Instrument existing server-side LLM operations to report real usage when providers
  expose it, including spec assist, draft generation, audits, contradiction checks,
  classifiers, recommendations, and test prompts.
- [x] Extend MCP/client guidance so agents can report real model usage when their host
  exposes token accounting. Treat this as best-effort telemetry; projected context tokens
  remain the baseline when real usage is unavailable.
- [x] Add aggregation APIs for token reports:
  - project summary over a date range
  - tokens by spec
  - tokens by spec section
  - tokens by retrieval mode (`begin_task`, `get_specs`, `search`, `agent_pack`, `compile`)
  - tokens by agent session/task
  - projected vs real token comparison
- [x] Add token trend over time to the token report API and chart it in the UI.
- [x] Add a Reports token usage panel. The top-level view should list projects with
  projected context tokens, real prompt/completion tokens, estimated spend, most expensive
  specs, and most expensive sections.
- [ ] Promote token usage into a first-class Reports tab once the Reports page has tabbed
  navigation.
- [x] Add project drilldown in the Reports token panel. Selecting a project should show:
  spec-level totals, section-level totals, retrieval source, agent sessions/tasks, and
  real-vs-projected tokens.
- [ ] Extend project drilldown with feedback/compliance/code-trace links and last-used
  timestamps where they are not already surfaced by the aggregate tables.
- [ ] Add section drilldown showing the section text preview, version, delivered token
  history, searches that retrieved it, agents/sessions that loaded it, citations/evidence,
  feedback clusters, code-trace links, and whether it appears to earn its prompt cost.
- [ ] Add token ROI signals that combine delivered tokens, real prompt tokens, search hits,
  citations, code-trace links, compliance contribution, efficacy lift, and feedback/error
  rates. Do not equate "large" with "bad"; flag high-token low-signal sections for review.
- [ ] Add prompt saturation warnings for projects or tasks whose always-loaded specs exceed
  configurable context budgets. Recommend splitting large specs, changing token budget
  class, moving material to search-first reference detail, or promoting only critical
  sections to default context.
- [x] Add dashboard filters for date range, concrete project, agent session,
  model/provider, event type, spec, and section.
- [ ] Extend token usage filters to project type, repo, and token estimator once those
  dimensions are first-class report controls.
- [x] Add CSV export support for token usage reports so teams can analyze cost and ROI
  outside the UI.
- [x] Add JSON export support for token usage reports.
- [ ] Add retention controls for token telemetry. Keep section identifiers and counts long
  term, but allow pruning detailed task/query/provider rows in privacy-sensitive deployments.
- [x] Update generated agent guidance to explain optional real token usage reporting.
- [ ] Update AI-SDD docs to explain projected vs real tokens, how token usage is reported,
  and how reviewers should interpret token ROI.

## Validation & Dogfooding

The system is feature-rich but lightly battle-tested; every real signal so far has come from
actually running it, not from the backlog. Before adding more horizontal features, exercise the
whole loop end-to-end on a real project and let the friction re-rank everything below.

- [x] **Dogfood: build a real small app end-to-end in secured mode.** Stand up the server with
  `SPECREG_AUTH=required` + a real admin password, run `specreg init` in a fresh repo (agent
  enrolls its own scoped token), let an agent do `begin_task` → write code → pull guidance via
  `resolve_guidance` → `specreg comply`/`finish_task` loop → submit a change → human approves in
  the UI. Capture every point of friction, 401, confusing message, or governance gap as a
  finding. Expected to surface the next round of real work (as the game experiment did:
  auth hole, self-approval, compliance-loop need).
- [x] Dogfood fix: secured `specreg init --type ...` now enrolls the repo-bound agent before
  authenticated project-type and skill lookups, instead of failing with `401 Authentication
  required` before it has a token.
- [x] Dogfood finding: `resolve_guidance` can identify a missing topic/domain, but
  `report_spec_feedback` requires a `spec_id`; add a first-class missing-guidance feedback
  endpoint/tool so agents do not have to attach a pure gap to the nearest spec.
- [x] Dogfood finding: `specreg comply` recommends inline `// @spec[FILE#section]`
  annotations, but the current code-map linker does not parse annotation directives. Either
  implement annotation parsing or change the remediation text to match the token/spec linker
  that exists today. (Implemented annotation parsing: `code-map` now scans for
  `@spec[FILE#section]` above a declaration and links it at high confidence, ahead of the
  fuzzy text matcher.)
- [x] Dogfood finding: `submit-drafts --publish` prints the same "Open Reviews and Specs" next
  step after a newly created project-scoped spec is already published; tailor the CLI summary
  for created+published vs review-required updates.
- [x] Dogfood finding: the default Web App Standard pack lacks an API endpoint behavior/contract
  spec, so agents adding routes must generate a project-scoped spec before traceability can be
  meaningful. Consider adding a reusable `API_ENDPOINTS.md` starter spec/template to the pack.
- [x] better-sqlite3 native ABI mismatch across Node versions (broke the suite once, recurred
  locally on 2026-07-01 when a Node-24 rebuild met a Node-22 shell). Fixed with a self-healing
  guard (`packages/server/scripts/ensure-native.mjs`) wired into `predev`/`prestart`/`pretest`/
  `preseed`: it probes the module in a fresh process and, only on failure, rebuilds it for the
  running Node — so the version in use no longer matters. `.nvmrc` (24.13.1) remains a soft hint.
- [x] Remaining operability pass: this repo now has `.github/workflows/ci.yml` to run
  build+tests (which exercises the native-module guard) on a clean runner. Bound code-trace
  payload and at-rest secret encryption already landed during the dogfood rounds.
- [x] Encrypt-at-rest the LDAP bind password, webhook/Slack secrets, and LLM/embedding
  provider API keys and GitHub token, all previously stored plaintext in `settings`. Opt-in
  via `SPECREG_SECRET_KEY` (AES-256-GCM, key derived outside the database so a stolen SQLite
  file alone doesn't also hand over the key); unset behaves exactly as before (plaintext).

## Developer Workflow

- [x] Read-only `specreg scan`: a zero-config governance snapshot (single 0-100 Governance
  Score, coverage/drift/ungoverned-entity counts, annotation-theater detection, `--json`
  report) that needs no server, login, or enrollment and never fails CI. A fast on-ramp
  that shows an ungoverned repo where it stands before `specreg init`/`comply` are adopted.
- [x] Comprehensive guided new-project setup in `specreg init`, with custom stack choices,
  premade project-type fallback, structured profile output, and project-scoped draft submission.
- [x] Governed agent skill catalog with safe defaults, risk labels, admin registration,
  init-time selection, local `SKILL.md` installation, and generated-agent discovery guidance.
- [x] Project-local Google style guide onboarding during `specreg init`, with suggested
  multi-select, converted Markdown copies, and agent-discoverable guide manifests.
- [x] Official `specreg check` GitHub Action with optional PR comments.
- [x] Dashboard drift diagnostics from an uploaded or pasted `.specregistry.json`.
- GitHub App integration instead of raw `GITHUB_TOKEN`.
- [x] Generated spec update PR summaries and changelogs.
- [x] Spec change migration checklist generation for downstream projects.
- [x] Server self-update: `GET /api/v1/meta/version` (git sha/branch/dirty state + GitHub
  drift check) and an admin-only `POST /api/v1/admin/update` (`git pull --ff-only` +
  conditional `npm install` + `npm run build`), with a dashboard banner and Update now
  button. Only works for a live git checkout deployment (local/dev, production-style
  Node); a Docker deployment has no `.git` to pull into and reports as not a checkout.
- [ ] Docker-deployment parity for the self-update banner: today `is_git_checkout: false`
  inside a container just hides the Update now button. Consider a lighter "new image
  available" signal for Docker (e.g. compare the running image digest/tag against the
  latest published one) instead of leaving Docker operators with no drift signal at all.

## Governed Skills Marketplace

Skills should become governed, versioned procedure artifacts managed with the same discipline
as specs. A skill answers "how should an agent perform this workflow?", while a spec answers
"what is true or required for this system/domain?" Skills may reference specs, and specs may
recommend skills, but imported marketplace content must not become trusted guidance until it
passes provenance, review, versioning, assignment, and distribution gates.

- [ ] Split the current editable `agent_skills` row model into stable skill identity plus
  immutable `agent_skill_versions`, mirroring spec versioning. Preserve stable slugs,
  current version, status, built-in/custom origin, published content hash, changelog, and
  created/updated/published metadata.
- [ ] Add skill review/change-request workflow for creating, updating, disabling, deleting,
  and promoting skills. Built-in and marketplace skills should be reviewable through the
  same queue as specs, with audit log entries and reviewer attribution.
- [ ] Add scoped skill assignment: global, project type, and concrete project. Generated
  agent packs should include only active skills assigned to the target scope hierarchy,
  with project-scoped skills overriding or supplementing broader skills without mutating
  reusable project types.
- [ ] Expand risk classification beyond `safe` / `restricted`: suggested levels are
  `safe`, `bounded`, `tooling`, `networked`, `privileged`, and `blocked`. Store the
  rationale and make risk visible in the UI, generated `SKILL.md` metadata, manifests,
  and agent pack summaries.
- [x] Add first-class skill marketplace UI outside the LLM settings page for Installed,
  Candidates, and Sources.
- [ ] Extend the skill marketplace UI with Marketplace discovery, Reviews, and Assignments
  tabs as those backends land.
- [ ] Add skill detail pages showing rendered instructions, metadata, risk assessment,
  version history, changelog, assignments, related specs, source/provenance, downstream
  consumers, and review status.
- [x] Add external skill source registry for GitHub repos, local uploads, built-in packs,
  and manually authored sources. Store URL, provider, license, default branch, last fetched
  commit, last scan time, status, trust decision, and source notes.
- [x] Support curated starter sources such as:
  - `https://github.com/search?q=agent+skills&type=repositories`
  - `https://github.com/msitarzewski/agency-agents`
  - `anthropics/skills`
  - `addyosmani/agent-skills`
  - `vercel-labs/skills`
  - `google/skills`
  - `agentskills/agentskills`
  - curated `awesome-agent-skills` style lists
- [ ] Add GitHub source scanner for common skill and agent formats: `SKILL.md`,
  `.codex/skills/*/SKILL.md`, `.claude/agents/*.md`, `agents/*.md`, `AGENTS.md`,
  `README.md` skill sections, and repo-specific manifest files when present.
- [x] Create `skill_candidates` for imported but untrusted material. Candidates should
  retain source repo/path/commit, detected format, raw content hash, license, category,
  proposed name/slug, detected commands/network/secrets risk, and classifier notes.
- [x] Classify candidates into `agent_skill`, `spec_seed`, `project_type_template`,
  `reference_only`, `unsafe`, or `unknown`. Do not allow candidates to publish directly
  into active agent packs.
- [ ] Add LLM-assisted candidate conversion into governed skill drafts. The conversion
  should preserve useful workflow logic, remove irrelevant persona/fluff, normalize to
  SpecRegistry skill format, add safety boundaries, add related-spec references, and
  produce a reviewer-facing diff/summary.
- [ ] Add LLM-assisted conversion from candidate material into spec drafts when the source
  is better treated as reusable requirements than as agent procedure. This avoids turning
  agent role repositories into project types by accident.
- [ ] Add provenance metadata to governed skills: source URL, source commit SHA, source path,
  imported_at, transformed_by, transformation prompt/version, reviewer, local version, and
  whether local content intentionally diverged from upstream.
- [ ] Add upstream drift detection for imported sources. When a tracked repo/path changes,
  show "upstream update available" and create a reviewed update candidate rather than
  silently mutating the active skill.
- [x] Add deterministic security and quality gates for third-party skill candidates:
  prompt-injection scan, command intent scan, network/API intent scan, secrets scan,
  license check, size/token budget check, exact duplicate detection, and risk-level
  recommendation.
- [ ] Add deeper third-party skill quality gates: near-duplicate detection, conflict checks
  against active skills, richer license policy, and reviewer-tunable gate thresholds.
- [ ] Add explicit "skill does not grant permission" language to every rendered marketplace
  skill. Skills may tell an agent how to perform a workflow, but host approval policies,
  governed specs, RBAC, and tool permissions still decide what may actually be done.
- [ ] Add skill-spec relationships. Skills can declare related specs/sections; specs can
  recommend skills such as `run-compliance-loop`, `evaluate-quality-model`,
  `incident-response-triage`, `api-contract-review`, or `observability-gap-analysis`.
- [ ] Include locked skill versions in generated agent packs and `.spec/skills/manifest.json`.
  Manifest entries should include slug, version, scope, risk level, hash, source, and
  related specs.
- [ ] Extend `specreg check` to verify local skill currency alongside spec currency:
  up-to-date skills, outdated skills, missing skills, unknown local skills, and hash
  mismatches.
- [ ] Add CLI commands for marketplace workflows:
  `specreg skills list`, `specreg skills check`, `specreg skills sync`,
  `specreg skills search`, `specreg skills sources list`, and
  `specreg skills sources add <url>`.
- [ ] Add MCP tools for agent-visible skill discovery without broad context loading:
  list assigned skills, fetch one skill by slug/version, search approved skills, and report
  ambiguous/stale/missing skill guidance.
- [ ] Add recommendation engine for suggested skills based on project type, project profile,
  languages/frameworks, published specs, compliance failures, code-trace drift, feedback
  clusters, and open review topics.
- [ ] Track skill usage telemetry: which skills were packed, loaded, searched, fetched,
  referenced in agent sessions, associated with successful compliance, or correlated with
  feedback/errors. Feed low-value or high-risk signals back into review.
- [ ] Add marketplace search/filter facets: category, project type, language/framework,
  risk level, source, license, status, installed/assigned state, version freshness, and
  related spec.
- [ ] Add duplicate and conflict detection across skills. Warn when two active skills give
  competing instructions for the same workflow, tool, command, safety boundary, or spec.
- [ ] Add export/import of approved skill packs so organizations can curate internal packs
  and move them between SpecRegistry instances without re-scraping GitHub.
- [ ] Add documentation explaining the distinction between specs, project types,
  project-scoped specs, skills, candidates, and external sources so users do not convert
  one-off project knowledge or third-party prompt packs into reusable project types.

## Search and Discovery

- [x] Semantic search alongside FTS5.
- Saved searches for common policy areas such as auth, PII, deployment, and observability.
- [x] Spec impact explorer for browsing dependencies, consumers, recent usage, and drift outside
  the review flow.

## AST Metadata and Code-to-Spec Traceability

Completed adjacent foundations:

- [x] Spec-text embeddings and semantic/hybrid search for governed spec sections.
- [x] Manifest/version drift checks for local spec bundles via `specreg check`, uploaded
  manifest diagnostics, and project/report drift summaries.
- [x] Repo metadata/spec gap detector that uses tree/manifests/evidence to suggest missing
  governance specs.
- [x] Prometheus metrics endpoint for registry, review, usage, and SDD health signals.
- [x] Initial `specreg code-map` sidecar metadata generator for TypeScript/JavaScript AST
  entities plus Python and SQL extraction. Writes `.spec/code-map.json` with stable code
  IDs, entity kinds, paths, signatures, source locations, parent links, hashes, and route
  metadata without rewriting source files.
- [x] Settings-backed feature controls for automation and AST/code metadata families, with
  Docker/server-friendly environment defaults and database overrides from the Settings UI.
- [x] Expanded code metadata tagging for imports, package commands, config surfaces,
  migrations, SQL fields, and schema objects.
- [x] Stable-ID alias reporting when a prior code-map exists and entities move, rename, or
  otherwise retain a hash/path-name relationship.
- [x] Source-adjacent metadata workflow via `.spec/code-map.json` and `.spec/code-trace.json`
  sidecars, preserving source files unless a future inline-injection mode is explicitly
  enabled.
- [x] Initial code-to-spec traceability graph linking parsed entities to local Markdown specs,
  including confidence and match reasons.
- [x] Initial semantic drift and coverage pipeline in the trace report, including a 0.0-1.0
  drift score, severity, unmapped entity list, and linked/unlinked coverage counts by kind.
- [x] Code/AST embedding profile guidance in `.spec/code-trace.json` for separating code
  entity summaries from spec-text embeddings.
- [x] Server ingestion for `specreg code-map --report`, persisted code trace reports, and
  project-level Reports UI coverage/drift summaries.
- [x] CI traceability enforcement and PR annotations via `specreg trace-check` plus the
  bundled GitHub Action's optional code trace gate.

Remaining AST/code metadata work:

- [ ] Manual traceability override workflow to approve, reject, or intentionally waive
  automatic code-to-spec links and route unmapped entities to new spec work.
- [ ] Deepen the traceability system with manual override review, deleted-entity retention,
  split/merge history, richer dependency graphs, and additional language parsers.

## Enterprise

- Secrets hygiene with encrypted-at-rest LDAP bind passwords and webhook secrets.
- GitHub App integration instead of raw `GITHUB_TOKEN`.
- Read-only public share links for approved spec bundles.
- SCIM or scheduled LDAP user/group sync.
