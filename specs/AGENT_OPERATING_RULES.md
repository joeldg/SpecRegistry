# Agent Operating Rules

## Scope
This specification applies to AI agents, coding assistants, automation scripts, and MCP clients that read, search, compile, generate, audit, or modify work governed by SpecRegistry.

## Intent
Agents should make SpecRegistry usage repeatable and observable. They must load the right context, minimize token waste, cite governed guidance, and report spec problems rather than silently substituting model judgment.

## Requirements
1. Agents must use the SpecRegistry MCP server when available and call `get_specs` before non-trivial work.
2. Agents should use `search_specs` for focused context before loading large reference specs into a prompt.
3. In repo-specific work, agents must set or respect `SPECREG_REPO` so project-scoped specs can override project-type guidance.
4. In auth-required deployments, agents must use `SPECREG_TOKEN` and never print or commit it.
5. Agents must cite relevant spec filenames and sections in summaries when a change is materially governed by those specs.
6. Agents must call `report_spec_feedback` or the feedback API for ambiguity, contradiction, outdated guidance, or missing requirements.
7. Agents must distinguish approved specs from drafts, examples, local style guides, and generated prompts.
8. Agents must not claim checks passed unless they actually ran and observed the result.

## Non-Goals
This spec does not grant an agent permission to access production, secrets, protected branches, or external systems. Host approval and least-privilege rules still apply.

## Acceptance Evidence
- Agent output references the active registry URL or MCP config.
- Work summaries cite specs or explain why no governing spec applied.
- Feedback records exist for unclear or conflicting guidance.
- Auth-required MCP clients include a token path without exposing token values.

## Token Budget Class
Workflow rule. Load by default for agents, but keep concise and operational.

## Related Specs
- `SDD_OPERATING_MODEL.md`
- `TOKENOMICS.md`
- `IMPLEMENTATION_EVIDENCE.md`

## AI Agent Directives
Use governed specs as authority. Prefer registry search over broad context loading. Stop on missing or conflicting guidance. Never treat local generated files or examples as published specifications.
