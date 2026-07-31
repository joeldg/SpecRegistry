# SpecRegistry Agent Guide

You are working on SpecRegistry, an SDD control plane for governing Markdown specifications, distributing agent context, and observing whether specs are useful, coherent, and followed.

## Before You Start

**Load governed specs first.** Call `get_specs` or `begin_task` via the `specregistry` MCP server before non-trivial changes. The MCP server is configured in `.mcp.json`. If MCP is not available, the compiled context in `CLAUDE.md` is the bootstrap — but it is a snapshot, not the live source.

Set `SPECREG_REPO=github.com/joeldg/SpecRegistry` so project-scoped specs (DESIGN.md, STRUCTURE.md, PROJECT_PROFILE.md, CODE_TRACE_SCOPE.md, SPEC_SECTION_EVIDENCE.md) load alongside global and project-type specs.

Use `search_specs` for focused lookups before pulling large reference specs into context. Report ambiguity, contradiction, or outdated guidance with `report_spec_feedback` — do not guess around it.

## North Star

Preserve strict Spec Driven Development:

- Specs are versioned source-of-truth documents.
- Implementations must be traceable to current reviewed specs.
- Agents must load governed specs through MCP or generated context before touching code.
- Ambiguity, contradiction, and outdated guidance must be reported, not guessed around.
- Token cost matters: specs should earn their prompt/context budget.

The authoritative governed specs are in `specs/`. For architecture decisions, read `specs/DESIGN.md` and `specs/STRUCTURE.md`. For API contracts, read `specs/API.md`. For the project profile (stack, data stores, deployment), read `specs/PROJECT_PROFILE.md`.

## Repository Layout

- `packages/server`: Fastify API, SQLite schema, review workflow, audit log, auth/LDAP, integrations.
- `packages/web`: React/Vite dashboard.
- `packages/cli`: `specreg` CLI.
- `packages/mcp`: MCP stdio server for agents.
- `packages/shared`: shared TypeScript types/helpers.
- `samples/ai-sdd`: sample SDD spec pack.

## Commands

```sh
npm run build
npm test
npm run dev:server
npm run dev:web
```

The API defaults to `http://localhost:4000`. The Vite app defaults to `http://localhost:5173`.

## Development Rules

- Prefer existing patterns and small vertical slices.
- Keep database migrations append-only in `packages/server/src/db.ts`.
- Add tests for server behavior changes (`packages/server/test`).
- Add tests for CLI behavior changes (`packages/cli/test`).
- Update `specs/` (via registry change request) when API surface, authentication, schema, or SDD workflow changes.
- Update `docs/` when deployment or developer workflow changes.
- Do not bypass review, approval policy, audit log, or feedback-loop semantics.
- Keep generated agent/MCP artifacts aware of `SPECREG_PUBLIC_URL` for Docker/server deployments.
- Keep CLI/MCP documentation and generated guidance aware of `SPECREG_TOKEN` for auth-required registries.

## Git Hooks Setup

After cloning, install the local git hooks once:

```sh
bash scripts/install-hooks.sh
# or
npm run install-hooks
```

This installs a `prepare-commit-msg` hook (symlinked from `scripts/prepare-commit-msg`)
that runs `specreg comply` automatically and appends the three compliance trailers to every
commit message. The hook reads `SPECREG_SERVER` from the environment or from `.env`; if the
server is unreachable it warns but does not block the commit.

Hooks in `scripts/` are tracked in source control. Re-running the installer is safe.

## Commit Evidence

Every implementation commit must include SpecRegistry compliance trailers. With the git
hook installed, trailers are appended automatically. Without it, run `specreg comply`
manually and paste the output into the commit message:

```
SpecRegistry-Compliance: PASS objective=100/100 attempt=1
SpecRegistry-Signals: coverage=100% drift=0%
SpecRegistry-Command: specreg comply
```

You can also run compliance on demand:

```sh
npm run comply
# or
SPECREG_SERVER=http://localhost:4000 specreg comply
```

Do not claim a check passed without running it and observing the result.

## Spec Changes

Published specs change through the registry review workflow — never edit files in `specs/` directly. To propose a change:

1. POST to `/api/v1/specs/review` with `proposed_content`, `version_delta`, and `proposed_by`.
2. The change request is reviewed and approved by a human before publication.
3. After publication, run `specreg sync` to pull the updated bundle.

Draft specs go under `.spec/drafts/` or the registry draft workflow, not directly into `specs/`.

## Docker/Public URL

When generating agent packs or MCP guide content, use the registry's public URL, not the bind address. The server resolves it from:

1. `SPECREG_PUBLIC_URL`
2. forwarded host/proto headers
3. `http://localhost:${PORT || 4000}`

In Docker or behind a proxy, set `SPECREG_PUBLIC_URL` to the URL that developer machines and agents can reach.

## CLI/MCP Authentication

The CLI accepts `--token <token>` and reads `SPECREG_TOKEN`. The MCP server also reads `SPECREG_TOKEN` and sends it as a Bearer token to the registry. Set `SPECREG_REPO` to load project-scoped context. When updating agent packs, MCP guide content, or README examples, include this auth path for deployments using `SPECREG_AUTH=required`.
