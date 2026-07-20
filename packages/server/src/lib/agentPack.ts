import { SPECREGISTRY_PRODUCT_REPOSITORY_URL, type ProjectType } from "@specregistry/shared";

export function mcpConfig(serverUrl: string, projectType?: ProjectType, repo = "owner/repo") {
  return {
    mcpServers: {
      specregistry: {
        command: "specreg",
        args: ["mcp"],
        env: {
          SPECREG_SERVER: serverUrl,
          ...(projectType ? { SPECREG_PROJECT_TYPE: projectType.name } : {}),
          SPECREG_REPO: repo,
        },
      },
    },
  };
}

export function mcpSkillMarkdown(serverUrl: string, projectType?: ProjectType, repo = "owner/repo"): string {
  return `# SpecRegistry MCP Skill

Use this skill when working in a SpecRegistry managed project.
Learn more: ${SPECREGISTRY_PRODUCT_REPOSITORY_URL}

## Configure MCP

Add this server to the repository's MCP configuration. The generated command uses
\`specreg mcp\` so the dashboard-downloaded CLI also supplies the MCP server; local
development may still link \`specreg-mcp\`, but initialized repos should prefer this form:

\`\`\`json
${JSON.stringify(mcpConfig(serverUrl, projectType, repo), null, 2)}
\`\`\`

If the project type is not preconfigured, call \`list_project_types\` first and choose the best match.
If the registry requires authentication, add \`SPECREG_TOKEN\` to the MCP server \`env\` block. Use a
login token or long-lived API key with the minimum role needed for the workflow.
Do not run \`specreg mcp\` directly as a health check; it is a stdio server and may exit
when no MCP client keeps stdin/stdout open. Run \`specreg mcp --check\` to test registry
reachability and authentication from the same environment.
If the agent host reports \`policy_denied\`, \`EPERM\`, or another network-policy block for \`SPECREG_SERVER\`,
do not treat that as a SpecRegistry auth failure. Configure Settings > Integrations > Server reachability
or \`SPECREG_PUBLIC_URL\` to a URL reachable from that sandbox, such as public DNS, VPN, or a tunnel.
When working in a concrete repository, set \`SPECREG_REPO\` to the repo identity reported by \`specreg init\`
so project-scoped specs and overrides load with global and project-type specs.

## Required Workflow

Do not edit code, configuration, tests, or generated artifacts until the pre-implementation gate is complete:

1. Run \`specreg check\` and stop on drift, missing specs, or tampered governed files.
2. Start the \`specregistry\` MCP server from \`.mcp.json\` and call \`begin_task\` for the project type and repo.
3. Call \`get_specs\` for the project type and repo, using the \`begin_task\` response as the preflight session record.
4. Load relevant governed procedures from \`.spec/skills/*/SKILL.md\` when present, or call \`list_assigned_skills\` / \`search_approved_skills\` and then \`get_skill\`, before performing that workflow.
5. Use \`search_specs\` with \`mode: "hybrid"\`, the project type, and repo when you need focused guidance from a large spec set.
6. If specs are ambiguous, contradictory, outdated, or missing intent, call \`report_spec_feedback\` with the affected \`spec_id\`, issue type, description, and relevant code or spec context. If no existing spec covers the area, call \`report_spec_feedback\` with \`error_type: "missing_guidance"\` instead (no \`spec_id\` needed).
7. Do not silently ignore a governed requirement. Either follow it or report feedback.
8. If MCP is unavailable, use only the documented agent API fallback, record that MCP was unavailable, and do not browse/probe registry routes.
9. Before reporting completion, call \`finish_task\` with the \`session_id\` from \`begin_task\`; keep working until the objective verdict passes. Use \`check_compliance\` or \`specreg comply\` for direct compliance checks and CI gates.
10. Fix failed compliance with targeted evidence only: add \`@spec[FILE#section]\` annotations only when the code entity is truly governed by that exact section. Do not blanket-map files to \`PROJECT_PROFILE.md\`, broad requirements sections, or convenient specs just to raise coverage; report missing_guidance or propose a spec when no section governs the behavior.
11. If repeated \`finish_task\`, \`check_compliance\`, or \`specreg comply\` attempts still fail, halt autonomous remediation and show the user the exact latest output.
12. Before creating a git commit for implementation work, include compact compliance evidence in the commit message body: the \`SpecRegistry-Compliance:\`, \`SpecRegistry-Signals:\`, and \`SpecRegistry-Command:\` trailer emitted by \`specreg comply\`, or equivalent \`finish_task\` evidence with verdict, objective score, and session id.
13. If \`finish_task\`, \`check_compliance\`, or \`specreg comply\` cannot run because MCP or the SpecRegistry server appears unavailable, halt before reporting completion or committing. Notify the user that objective compliance could not be verified, include the exact tool or command output, and do not substitute local-only checks for the registry completion gate.
14. If the agent host exposes model token usage, call \`report_token_usage\` with the \`session_id\`; this is optional telemetry for token ROI and never replaces the completion/compliance gate.

## MCP Tools

- \`begin_task\`: register an agent session, preflight the task, and return the governed spec bundle to load.
- \`finish_task\`: record completion evidence, run objective compliance, and block completion until it passes.
- \`list_project_types\`: list configured project types.
- \`get_specs\`: fetch full markdown specs for a project type, including global specs and repo-specific overrides.
- \`search_specs\`: search matching spec sections with FTS, semantic, or hybrid retrieval, including project-scoped specs when a repo is configured.
- \`list_assigned_skills\`: list active governed skills assigned to the project type/repo scope without loading all skill markdown.
- \`search_approved_skills\`: search assigned active skills by workflow, source, or related spec.
- \`get_skill\`: fetch one assigned active skill by slug as governed markdown.
- \`resolve_guidance\`: check whether a language/domain is covered before inventing a local standard.
- \`check_compliance\`: record and evaluate the objective compliance loop for the repo.
- \`report_token_usage\`: report real LLM token usage from the agent host when available.
- \`report_spec_feedback\`: file ambiguity, contradiction, or outdated-guidance feedback for review, or (\`error_type: "missing_guidance"\`) a pure coverage gap with no spec to attach to.
- \`get_audit_prompt\`: fetch reverse-conformance prompts for checking implementation against spec intent.
`;
}
