# SpecRegistry Agent Guide

You are working on SpecRegistry, an SDD control plane for governing Markdown specifications, distributing agent context, and observing whether specs are useful, coherent, and followed.

## North Star

Preserve strict Spec Driven Development:

- Specs are versioned source-of-truth documents.
- Implementations should be traceable to current specs.
- Agents should load governed specs through MCP or generated context files.
- Ambiguity, contradiction, and outdated guidance should be reported, not guessed around.
- Token cost matters: specs should earn their prompt/context budget.

Read these docs before large changes:

- `README.md` for package layout, commands, and API surface.
- `docs/SPEC.md` for the product specification.
- `docs/SDD_TOKENOMICS.md` for the operating model, observability goals, and SDD failure modes.
- `docs/TODO.md` for planned add-ons.

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

The API defaults to `http://localhost:4000`. The Vite app defaults to `http://localhost:5173` and proxies `/api` to the API.

## Development Rules

- Prefer existing patterns and small vertical slices.
- Keep database migrations append-only in `packages/server/src/db.ts`.
- Add tests for server behavior changes.
- Update README/docs when API surface, deployment, or SDD workflow changes.
- Do not bypass review, approval policy, audit log, or feedback-loop semantics casually.
- Keep generated agent/MCP artifacts aware of `SPECREG_PUBLIC_URL` for Docker/server deployments.
- Leave unrelated local files alone, especially user-specific config.

## Docker/Public URL

When generating agent packs or MCP guide content, use the registry's public URL, not the bind address. The server resolves it from:

1. `SPECREG_PUBLIC_URL`
2. forwarded host/proto headers
3. `http://localhost:${PORT || 4000}`

In Docker or behind a proxy, set `SPECREG_PUBLIC_URL` to the URL that developer machines and agents can reach.
