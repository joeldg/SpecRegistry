# AI Agents and MCP

## AI Agent and MCP Usage

After `specreg init`, MCP-capable agents can use the generated `.mcp.json`:

```json
{
  "mcpServers": {
    "specregistry": {
      "command": "specreg",
      "args": ["mcp"],
      "env": {
        "SPECREG_SERVER": "https://specs.example.com",
        "SPECREG_PROJECT_TYPE": "Web App Standard",
        "SPECREG_REPO": "github.com/acme/web-app",
        "SPECREG_TOKEN": "sreg_..."
      }
    }
  }
}
```

`specreg init` includes `SPECREG_TOKEN` in the generated `.mcp.json` when the token is
present in the environment or passed with `--token`.

The MCP server exposes these tools:

- `begin_task` — register an agent session, run preflight, and return the governed spec bundle to load.
- `finish_task` — record completion evidence, run objective compliance, and block completion until it passes.
- `list_project_types` — discover registry project types.
- `get_specs` — fetch governed global + project-type + project-scoped specs.
- `search_specs` — retrieve matching spec sections, including project-scoped matches, without loading everything.
- `resolve_guidance` — check whether a language or domain is governed before inventing a local standard.
- `check_compliance` — record and evaluate the objective compliance loop directly, useful for CI or ad hoc checks.
- `report_token_usage` — optional telemetry for real model token usage when the agent host exposes counts.
- `get_audit_prompt` — fetch a reverse-conformance audit prompt for a governed spec.
- `report_spec_feedback` — file ambiguity, contradiction, or outdated-guidance feedback, or
  (`error_type: "missing_guidance"`) a pure coverage gap with no `spec_id` to attach to.

For the full agent feedback loop, including compiled files, MCP tool usage, dashboard
triage, draft fixes, and release/sync behavior, see [agent workflow reference](../README-AGENTS.md).

Direct agent endpoints are also available:

```sh
curl http://localhost:4000/api/v1/ai/specs/Web%20App%20Standard
curl "http://localhost:4000/api/v1/ai/specs/Web%20App%20Standard?repo=github.com/acme/web-app"
curl "http://localhost:4000/api/v1/ai/search?q=authentication&project_type=Web%20App%20Standard&repo=github.com/acme/web-app"
curl -X POST http://localhost:4000/api/v1/ai/token-usage -H "content-type: application/json" -d '{"session_id":"SESSION_ID","provider":"openai","model":"gpt-4.1","prompt_tokens":1200,"completion_tokens":300}'
curl http://localhost:4000/api/v1/ai/mcp-guide/Web%20App%20Standard
curl -o agent-pack.zip http://localhost:4000/api/v1/specs/Web%20App%20Standard/agent-pack
```

Agents should read specs before implementation, search when they need narrower guidance,
cite returned section permalinks when reporting findings, optionally report host-visible
model token usage for token ROI, and report feedback instead of guessing when a spec is
ambiguous, contradictory, or stale.
