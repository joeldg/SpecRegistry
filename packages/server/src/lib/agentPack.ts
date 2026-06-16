import type { ProjectType } from "@specregistry/shared";

export function mcpConfig(serverUrl: string, projectType?: ProjectType) {
  return {
    mcpServers: {
      specregistry: {
        command: "specreg-mcp",
        args: [],
        env: {
          SPECREG_SERVER: serverUrl,
          ...(projectType ? { SPECREG_PROJECT_TYPE: projectType.name } : {}),
        },
      },
    },
  };
}

export function mcpSkillMarkdown(serverUrl: string, projectType?: ProjectType): string {
  return `# SpecRegistry MCP Skill

Use this skill when working in a repository governed by SpecRegistry.

## Configure MCP

Add this server to the repository's MCP configuration:

\`\`\`json
${JSON.stringify(mcpConfig(serverUrl, projectType), null, 2)}
\`\`\`

If the project type is not preconfigured, call \`list_project_types\` first and choose the best match.
If the registry requires authentication, add \`SPECREG_TOKEN\` to the MCP server \`env\` block. Use a
login token or long-lived API key with the minimum role needed for the workflow.

## Required Workflow

1. Before making code changes, call \`get_specs\` for the project type. Treat global specs and project-type specs as governing instructions.
2. Use \`search_specs\` when you need focused guidance from a large spec set.
3. If specs are ambiguous, contradictory, or outdated, call \`report_spec_feedback\` with the affected \`spec_id\`, issue type, description, and relevant code or spec context.
4. Do not silently ignore a governed requirement. Either follow it or report feedback.
5. When a local repo has run \`specreg init\`, respect the checked-in \`specs/.specregistry.json\` manifest and use \`specreg check\` or \`specreg sync\` to detect drift.

## MCP Tools

- \`list_project_types\`: list configured project types.
- \`get_specs\`: fetch full markdown specs for a project type, including global specs.
- \`search_specs\`: search matching spec sections.
- \`report_spec_feedback\`: file ambiguity, contradiction, or outdated-guidance feedback for review.
`;
}
