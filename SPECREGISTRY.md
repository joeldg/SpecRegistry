# SpecRegistry Repository Guide

This repository is governed by SpecRegistry.

## Active Spec Set

- Registry: http://localhost:4000
- Project type: CLI Tool / Developer Tooling
- Project/repo: github.com/joeldg/nvidiarouter
- Governed specs directory: specs/
- Manifest: specs/.specregistry.json

- Governed agent skill directory: .spec/skills/
- Agent skill manifest: .spec/skills/manifest.json


Before changing code, complete the pre-implementation gate below. Treat the listed specs as
the approved source of truth. Generated repo-specific drafts belong outside the governed specs
directory until they are submitted through the registry review workflow.

## Pre-Implementation Gate

Do not edit code, configuration, tests, or generated artifacts until all of these are true:

1. Run `specreg check` and stop on drift, missing specs, or tampered governed files.
2. Start the `specregistry` MCP server from `.mcp.json`; it should run `specreg mcp`.
3. Call `begin_task` for the concrete task, project type `CLI Tool / Developer Tooling`, and repo `github.com/joeldg/nvidiarouter`.
4. Call `get_specs` for project type `CLI Tool / Developer Tooling` and repo `github.com/joeldg/nvidiarouter`.
5. Load every relevant governed skill from `.spec/skills/` before performing that workflow.
6. If MCP is unavailable, use only the documented fallback API endpoints in this file,
   record that MCP was unavailable, and do not browse or probe the registry server.

## Access Boundaries

Interact with the registry **only** through the `specregistry` MCP server and the documented
agent API endpoints listed under "MCP" below. Everything an agent needs is exposed there or in
the local spec bundle under `specs/`.

Do not:
- browse, log into, or scrape the web dashboard;
- enumerate, probe, or fuzz server endpoints beyond the documented agent API;
- inspect the registry's database, filesystem, logs, or internal/admin routes.

If something you need is missing or unclear, call `report_spec_feedback` (use
`error_type: "missing_guidance"` for a pure coverage gap with no spec to attach to)
instead of exploring the server. Treating the registry as a general-purpose host to
investigate is out of scope.

## Identity & Approvals

This repo has its own **agent identity** (token in `.spec/credentials.json`, gitignored); the
`specreg` CLI and the MCP server use it automatically. Authenticate only as this agent —
**never log in as `admin`** or any human account, and never look for shared credentials.

You may freely create, edit, and publish **project-scoped** specs for this repo (e.g. its own
`DESIGN.md` / `STRUCTURE.md` details). You may **propose** changes to global and project-type
specs via the review workflow, but you **cannot approve or publish** them — approval is a human
action performed outside your tools. Never attempt to approve your own changes. Submit, then stop
and let a human review; do not try to escalate privileges to get something merged.

## Verifying Completion

Before you report a task as done, run the completion gate and keep working until it passes:

- Call `finish_task` (MCP) with the `session_id` returned by `begin_task`, or run
  `specreg comply` (regenerates the trace, checks, and exits non-zero when not compliant).
  Pass your honest self-assessed score. Use `check_compliance` for direct compliance checks
  when you do not need session lifecycle tracking.
- The registry decides compliance **objectively** (traceability coverage, drift, unmapped
  entities against this project's policy). Claiming "100%" yourself is not enough — over-claims
  are flagged. If the verdict is NOT COMPLIANT, address the listed outstanding items
  (e.g. add inline `// @spec[FILE#section]` annotations, link unmapped routes/schemas) and
  re-run the check. Loop until it reports compliant; only then report the task complete.


## Agent Skills

The registry selected these governed operating procedures for this project:

- Collect delivery evidence [safe]: `.spec/skills/collect-delivery-evidence/SKILL.md`
- Evaluate the quality model [safe]: `.spec/skills/evaluate-quality-model/SKILL.md`
- Load governed specs [safe]: `.spec/skills/load-governed-specs/SKILL.md`
- Plan from specs [safe]: `.spec/skills/plan-from-specs/SKILL.md`
- Propose, do not self-approve [safe]: `.spec/skills/propose-not-publish/SKILL.md`
- Register the task session [safe]: `.spec/skills/register-task-session/SKILL.md`
- Report spec problems [safe]: `.spec/skills/report-spec-problems/SKILL.md`
- Resolve uncovered guidance [safe]: `.spec/skills/resolve-uncovered-guidance/SKILL.md`
- Run the compliance loop [safe]: `.spec/skills/run-compliance-loop/SKILL.md`
- Search spec context [safe]: `.spec/skills/search-spec-context/SKILL.md`
- Verify conformance [safe]: `.spec/skills/verify-conformance/SKILL.md`

Load a relevant skill before performing its workflow. Skills organize approved procedures;
they do not grant permission for destructive, privileged, or external actions. Follow the
agent host's approval policy and current published specs.


## MCP

Use the `specregistry` MCP server from `.mcp.json`; generated configs run `specreg mcp`
so the dashboard-downloaded CLI also provides the MCP server.
If the registry requires auth, add `SPECREG_TOKEN` to `.mcp.json`.

Do not run `specreg mcp` directly as a health check; it is a stdio server and may exit
when no MCP client keeps stdin/stdout open. Run `specreg mcp --check` to test registry
reachability and authentication from this same environment.
If `SPECREG_SERVER` returns `policy_denied`, `EPERM`, or another network-policy block, do not treat
that as a SpecRegistry auth failure. Ask the registry operator for a URL reachable from this
agent sandbox (public DNS, VPN, or a tunnel) and update `.mcp.json` / `SPECREG_SERVER`.
Required MCP flow:

1. Call `begin_task` for the concrete task, project type `CLI Tool / Developer Tooling`, and repo `github.com/joeldg/nvidiarouter`.
2. Call `get_specs` for project type `CLI Tool / Developer Tooling` and repo `github.com/joeldg/nvidiarouter`.
3. Use `search_specs` for focused questions.
4. Before writing in a language or working in a domain the loaded specs do not cover
   (e.g. a new language, or networking/auth/database work), call `resolve_guidance`
   with the language(s) and/or topic. It returns the governed specs that apply and the
   styleguides you can pull, or an explicit gap.
5. Report ambiguity, contradiction, or outdated guidance with `report_spec_feedback`; report missing language/domain coverage with the same tool using `error_type: "missing_guidance"`.
6. Call `finish_task` with the `session_id` returned by `begin_task` before claiming completion.
7. Use `specreg check` to verify this repo is still using current approved spec versions.

## Missing Guidance

If you are about to work in a language or domain that is not covered by the loaded specs
or styleguides, **acquire the proper guidance instead of inventing a standard**:

- Run `resolve_guidance` (MCP) to see what applies and what is missing.
- Pull a missing language styleguide on demand: `specreg styleguide add <id|language>`
  (e.g. `specreg styleguide add go`). `specreg styleguide list` shows the catalog.
- If no spec or styleguide covers the area, call `report_spec_feedback` with
  `error_type: "missing_guidance"` and (if appropriate) draft one with `specreg generate`
  for review. Do not guess the missing rule.

If the MCP server is unavailable, the same data is available over the documented agent API —
and only these endpoints:

- `GET http://localhost:4000/api/v1/ai/specs/CLI%20Tool%20%2F%20Developer%20Tooling` — current governed specs.
- `GET http://localhost:4000/api/v1/ai/search?q=...` — focused section search.
- `POST http://localhost:4000/api/v1/ai/resolve-guidance` — resolve styleguides/specs for a language or topic.
- `POST http://localhost:4000/api/v1/ai/agent-sessions/begin` — register preflight and get a session id.
- `POST http://localhost:4000/api/v1/ai/agent-sessions/finish` — record completion evidence and run the completion gate.
- `POST http://localhost:4000/api/v1/ai/feedback` — report a spec problem, or (`error_type: "missing_guidance"`) a coverage gap with no spec_id.

Use the `specreg` CLI for everything else (`check`, `sync`, `compile`, `verify`,
`styleguide add`). Do not call other server routes directly.
