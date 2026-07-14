import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

export interface McpServerOptions {
  server: string;
  token?: string;
  projectType?: string;
  repo?: string;
}

function errorMessage(error: unknown): string {
  if (error && typeof error === "object" && "cause" in error) {
    const cause = (error as { cause?: unknown }).cause;
    if (cause && typeof cause === "object") {
      const code = "code" in cause && typeof cause.code === "string" ? cause.code : undefined;
      const message = "message" in cause && typeof cause.message === "string" ? cause.message : undefined;
      if (code && message) return `${code}: ${message}`;
      if (message) return message;
    }
  }
  return error instanceof Error ? error.message : String(error);
}

function networkPolicyHint(detail: string): string {
  return /policy_denied|eperm|forbidden by policy|network policy/i.test(detail)
    ? " The agent host appears to be blocking this network target; use a registry URL that is reachable from that sandbox, such as a public DNS name, VPN-accessible host, or tunnel."
    : "";
}

function httpDetail(body: { message?: string; error?: string; title?: string; detail?: string; status?: number }, fallback: string): string {
  const primary = body.message ?? body.error ?? body.title ?? fallback;
  return body.detail && body.detail !== primary ? `${primary}: ${body.detail}` : primary;
}

async function api<T>(serverUrl: string, token: string | undefined, path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (token && !headers.has("authorization")) headers.set("authorization", `Bearer ${token}`);
  const url = `${serverUrl}${path}`;
  let res: Response;
  try {
    res = await fetch(url, { ...init, headers });
  } catch (err) {
    const detail = errorMessage(err);
    throw new Error(`Could not reach SpecRegistry at ${new URL(url).origin}: ${detail}.${networkPolicyHint(detail)}`);
  }
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = (await res.json()) as { message?: string; error?: string; title?: string; detail?: string; status?: number };
      detail = httpDetail(body, detail);
    } catch {
      // non-JSON error body
    }
    throw new Error(`SpecRegistry API error ${res.status}: ${detail}.${networkPolicyHint(detail)}`);
  }
  return (await res.json()) as T;
}

export async function checkMcpConnectivity(opts: McpServerOptions): Promise<void> {
  const defaultType = opts.projectType ?? process.env.SPECREG_PROJECT_TYPE;
  const defaultRepo = opts.repo ?? process.env.SPECREG_REPO;
  console.log(`SpecRegistry server: ${opts.server}`);
  await api(opts.server, opts.token, "/api/v1/health");
  console.log("health: ok");
  const types = await api<Array<{ name?: string; scope?: string }>>(opts.server, opts.token, "/api/v1/project-types");
  console.log(`project_types: ${types.length}`);
  if (defaultType) {
    const params = new URLSearchParams();
    if (defaultRepo) params.set("repo", defaultRepo);
    const specs = await api<{ specs?: unknown[] }>(
      opts.server,
      opts.token,
      `/api/v1/ai/specs/${encodeURIComponent(defaultType)}${params.size ? `?${params}` : ""}`
    );
    console.log(`agent_specs: ${specs.specs?.length ?? 0} (${defaultType}${defaultRepo ? `, ${defaultRepo}` : ""})`);
  } else {
    console.log("agent_specs: skipped (set SPECREG_PROJECT_TYPE or pass --type)");
  }
  console.log("mcp_check: ok");
}

function text(value: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: typeof value === "string" ? value : JSON.stringify(value, null, 2),
      },
    ],
  };
}

export async function runMcpServer(opts: McpServerOptions): Promise<void> {
  const defaultType = opts.projectType ?? process.env.SPECREG_PROJECT_TYPE;
  const defaultRepo = opts.repo ?? process.env.SPECREG_REPO;
  const server = new McpServer({ name: "specregistry", version: "0.1.0" });

  server.tool(
    "begin_task",
    "Call this BEFORE non-trivial implementation work. It registers the agent session, records the task/model/repo, returns the governed spec bundle for this project, and tells you whether preflight is ready or blocked. Use the returned session_id when calling finish_task.",
    {
      task: z.string().describe("The concrete task you are about to perform."),
      plan: z.string().optional().describe("Short implementation and verification plan mapped to the specs when known."),
      model: z.string().optional().describe("Model or agent runtime being used."),
      branch: z.string().optional().describe("Current git branch, if known."),
      specs_loaded: z.array(z.string()).optional().describe("Spec filenames or ids already loaded by the agent."),
      agent_identifier: z.string().optional().describe("Your model/agent name. Defaults to mcp-agent."),
      project_type: z.string().optional().describe("Project type name. Defaults to the repo's configured type."),
      repo: z.string().optional().describe("Repo/project identity. Defaults to SPECREG_REPO when set."),
      project_id: z.string().optional().describe("Explicit SpecRegistry project id."),
    },
    async ({ task, plan, model, branch, specs_loaded, agent_identifier, project_type, repo, project_id }) => {
      const type = project_type ?? defaultType;
      if (!type) throw new Error("No project_type given and SPECREG_PROJECT_TYPE is not set");
      return text(
        await api(opts.server, opts.token, "/api/v1/ai/agent-sessions/begin", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            task,
            plan,
            model,
            branch,
            specs_loaded: specs_loaded ?? [],
            agent_identifier,
            project_type: type,
            project_id,
            repo: project_id ? undefined : (repo ?? defaultRepo),
            mcp_server: opts.server,
          }),
        })
      );
    }
  );

  server.tool(
    "finish_task",
    "Call this instead of directly claiming done or committing. It records completion evidence, runs the objective compliance gate, updates the agent session, and blocks completion until compliance passes. Failed compliance must be remediated with targeted spec evidence only; do not add speculative or blanket @spec annotations, and halt with the exact output after repeated failures. Include the finish_task verdict, objective score, and session id in the commit message body when using this instead of the specreg comply trailer.",
    {
      session_id: z.string().optional().describe("Session id returned by begin_task."),
      summary: z.string().optional().describe("What changed and why it satisfies the specs."),
      tests: z.array(z.string()).optional().describe("Verification commands or checks actually run."),
      changed_files: z.array(z.string()).optional().describe("Files changed by the task."),
      self_assessed_score: z.number().optional().describe("Your honest 0-100 estimate of how fully the work satisfies the specs."),
      trace: z.record(z.unknown()).optional().describe("Optional inline code-map trace; otherwise the registry uses the latest uploaded report."),
      project_type: z.string().optional().describe("Project type name. Required when session_id is omitted; defaults to configured type."),
      repo: z.string().optional().describe("Repo/project identity. Defaults to SPECREG_REPO when set."),
      project_id: z.string().optional().describe("Explicit SpecRegistry project id."),
    },
    async ({ session_id, summary, tests, changed_files, self_assessed_score, trace, project_type, repo, project_id }) => {
      const type = project_type ?? defaultType;
      if (!session_id && !type) throw new Error("No session_id or project_type given and SPECREG_PROJECT_TYPE is not set");
      return text(
        await api(opts.server, opts.token, "/api/v1/ai/agent-sessions/finish", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            session_id,
            summary,
            tests: tests ?? [],
            changed_files: changed_files ?? [],
            self_assessed_score,
            trace,
            project_type: type,
            project_id,
            repo: project_id ? undefined : (repo ?? defaultRepo),
          }),
        })
      );
    }
  );

  server.tool(
    "report_token_usage",
    "Best-effort telemetry: report real LLM token usage from the agent host when available. Use this after a model call if your runtime exposes token counts. This does not replace finish_task, check_compliance, or specreg comply.",
    {
      session_id: z.string().optional().describe("Session id returned by begin_task, if this usage belongs to a governed task."),
      provider: z.string().optional().describe("LLM provider, e.g. openai, anthropic, gemini, openrouter, local."),
      model: z.string().optional().describe("Model name used for the call."),
      route: z.string().optional().describe("Task route or purpose, e.g. coding, planning, review, summarization."),
      prompt_tokens: z.number().optional().describe("Prompt/input tokens reported by the model provider or agent host."),
      completion_tokens: z.number().optional().describe("Completion/output tokens reported by the model provider or agent host."),
      total_tokens: z.number().optional().describe("Total tokens if reported directly."),
      cached_tokens: z.number().optional().describe("Cached input tokens when reported by the provider."),
      total_cost_usd: z.number().optional().describe("Optional total estimated cost in USD."),
      latency_ms: z.number().optional().describe("Optional model call latency in milliseconds."),
      detail: z.string().optional().describe("Short human-readable context for the usage report."),
      agent_identifier: z.string().optional().describe("Your model/agent name."),
      project_type: z.string().optional().describe("Project type name. Defaults to the repo's configured type when session_id is omitted."),
      repo: z.string().optional().describe("Repo/project identity. Defaults to SPECREG_REPO when set."),
      project_id: z.string().optional().describe("Explicit SpecRegistry project id."),
    },
    async ({ session_id, provider, model, route, prompt_tokens, completion_tokens, total_tokens, cached_tokens, total_cost_usd, latency_ms, detail, agent_identifier, project_type, repo, project_id }) => {
      const type = project_type ?? defaultType;
      return text(
        await api(opts.server, opts.token, "/api/v1/ai/token-usage", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            session_id,
            provider,
            model,
            route,
            prompt_tokens,
            completion_tokens,
            total_tokens,
            cached_tokens,
            total_cost_usd,
            latency_ms,
            detail,
            agent_identifier: agent_identifier ?? "mcp-agent",
            project_type: session_id ? undefined : type,
            project_id,
            repo: session_id || project_id ? undefined : (repo ?? defaultRepo),
          }),
        })
      );
    }
  );

  server.tool(
    "list_project_types",
    "List the project types (organization hierarchy) configured in the spec registry.",
    {},
    async () => {
      const types = await api<Array<Record<string, unknown>>>(opts.server, opts.token, "/api/v1/project-types");
      return text(types.map(({ id, name, scope, industry, description }) => ({ id, name, scope, industry, description })));
    }
  );

  server.tool(
    "get_specs",
    "Fetch the latest governed specification documents (global + project type + project-specific overrides) with full markdown content. Always consult these before generating code for the project.",
    {
      project_type: z
        .string()
        .optional()
        .describe(`Project type name. Defaults to the repo's configured type${defaultType ? ` (${defaultType})` : ""}.`),
      repo: z.string().optional().describe("Repo/project identity for project-scoped specs. Defaults to SPECREG_REPO when set."),
      project_id: z.string().optional().describe("Explicit SpecRegistry project id."),
    },
    async ({ project_type, repo, project_id }) => {
      const type = project_type ?? defaultType;
      if (!type) throw new Error("No project_type given and SPECREG_PROJECT_TYPE is not set");
      const params = new URLSearchParams();
      if (project_id) params.set("project_id", project_id);
      else if (repo ?? defaultRepo) params.set("repo", repo ?? defaultRepo!);
      return text(await api(opts.server, opts.token, `/api/v1/ai/specs/${encodeURIComponent(type)}${params.size ? `?${params}` : ""}`));
    }
  );

  server.tool(
    "search_specs",
    "Search governed specification documents and get back matching sections only. Supports fts, semantic, and hybrid modes. Includes project-scoped specs when repo/project_id is provided or SPECREG_REPO is set.",
    {
      query: z.string().describe("Search terms, e.g. 'TLS firewall rules'"),
      mode: z.enum(["fts", "semantic", "hybrid"]).optional().describe("Search mode. Defaults to hybrid when semantic embeddings are indexed, otherwise fts."),
      project_type: z.string().optional().describe("Restrict to one project type (plus global and project-scoped specs)."),
      repo: z.string().optional().describe("Repo/project identity for project-scoped specs. Defaults to SPECREG_REPO when set."),
      project_id: z.string().optional().describe("Explicit SpecRegistry project id."),
    },
    async ({ query, mode, project_type, repo, project_id }) => {
      const params = new URLSearchParams({ q: query });
      params.set("mode", mode ?? "hybrid");
      const type = project_type ?? defaultType;
      if (type) params.set("project_type", type);
      if (project_id) params.set("project_id", project_id);
      else if (repo ?? defaultRepo) params.set("repo", repo ?? defaultRepo!);
      return text(await api(opts.server, opts.token, `/api/v1/ai/search?${params}`));
    }
  );

  server.tool(
    "list_assigned_skills",
    "List active governed skills assigned to the current project type/repo scope. Use this to discover approved procedures without loading every SKILL.md into context.",
    {
      project_type: z.string().optional().describe("Project type name. Defaults to SPECREG_PROJECT_TYPE."),
      repo: z.string().optional().describe("Repo/project identity for project-scoped skills. Defaults to SPECREG_REPO when set."),
      project_id: z.string().optional().describe("Explicit SpecRegistry project id."),
    },
    async ({ project_type, repo, project_id }) => {
      const type = project_type ?? defaultType;
      if (!type) throw new Error("No project_type given and SPECREG_PROJECT_TYPE is not set");
      const params = new URLSearchParams();
      if (project_id) params.set("project_id", project_id);
      else if (repo ?? defaultRepo) params.set("repo", repo ?? defaultRepo!);
      return text(await api(opts.server, opts.token, `/api/v1/ai/skills/${encodeURIComponent(type)}${params.size ? `?${params}` : ""}`));
    }
  );

  server.tool(
    "search_approved_skills",
    "Search active governed skills assigned to the current project type/repo scope by workflow, related spec, or source metadata. Fetch a returned skill with get_skill before following it.",
    {
      query: z.string().describe("Search terms, e.g. 'compliance loop', 'quality model', or a spec filename."),
      project_type: z.string().optional().describe("Project type name. Defaults to SPECREG_PROJECT_TYPE."),
      repo: z.string().optional().describe("Repo/project identity for project-scoped skills. Defaults to SPECREG_REPO when set."),
      project_id: z.string().optional().describe("Explicit SpecRegistry project id."),
    },
    async ({ query, project_type, repo, project_id }) => {
      const type = project_type ?? defaultType;
      if (!type) throw new Error("No project_type given and SPECREG_PROJECT_TYPE is not set");
      const params = new URLSearchParams({ q: query });
      if (project_id) params.set("project_id", project_id);
      else if (repo ?? defaultRepo) params.set("repo", repo ?? defaultRepo!);
      return text(await api(opts.server, opts.token, `/api/v1/ai/skills/${encodeURIComponent(type)}?${params}`));
    }
  );

  server.tool(
    "get_skill",
    "Fetch one active governed skill assigned to the current project type/repo scope as markdown, including safety boundary and related specs. Use the exact slug returned by list_assigned_skills or search_approved_skills.",
    {
      slug: z.string().describe("Skill slug, e.g. run-compliance-loop."),
      project_type: z.string().optional().describe("Project type name. Defaults to SPECREG_PROJECT_TYPE."),
      repo: z.string().optional().describe("Repo/project identity for project-scoped skills. Defaults to SPECREG_REPO when set."),
      project_id: z.string().optional().describe("Explicit SpecRegistry project id."),
    },
    async ({ slug, project_type, repo, project_id }) => {
      const type = project_type ?? defaultType;
      if (!type) throw new Error("No project_type given and SPECREG_PROJECT_TYPE is not set");
      const params = new URLSearchParams();
      if (project_id) params.set("project_id", project_id);
      else if (repo ?? defaultRepo) params.set("repo", repo ?? defaultRepo!);
      return text(await api(opts.server, opts.token, `/api/v1/ai/skills/${encodeURIComponent(type)}/${encodeURIComponent(slug)}${params.size ? `?${params}` : ""}`));
    }
  );

  server.tool(
    "resolve_guidance",
    "Call this BEFORE writing code in a language, or working in a domain/topic (networking, auth, database, deployment, etc.), that the already-loaded specs do not clearly cover. Returns the governed specs that apply, styleguides available to pull, and coverage gaps.",
    {
      languages: z.array(z.string()).optional().describe("Programming language(s) about to be written, e.g. ['Go', 'Rust']."),
      topic: z.string().optional().describe("Domain/topic about to be worked on, e.g. 'networking', 'authentication', 'database schema'."),
      project_type: z.string().optional().describe("Project type name. Defaults to the repo's configured type."),
      repo: z.string().optional().describe("Repo/project identity for project-scoped specs. Defaults to SPECREG_REPO when set."),
      project_id: z.string().optional().describe("Explicit SpecRegistry project id."),
    },
    async ({ languages, topic, project_type, repo, project_id }) => {
      const type = project_type ?? defaultType;
      return text(
        await api(opts.server, opts.token, "/api/v1/ai/resolve-guidance", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            languages: languages ?? [],
            topic,
            project_type: type,
            project_id,
            repo: project_id ? undefined : (repo ?? defaultRepo),
          }),
        })
      );
    }
  );

  server.tool(
    "check_compliance",
    "Call this BEFORE declaring a task complete or committing. It returns an objective compliance verdict for this repo plus a directive. If it is NOT compliant, remediate only with truthful, entity-specific spec evidence: add @spec[FILE#section] annotations only when the exact section governs the entity, or report/propose missing guidance. Do not blanket-map to PROJECT_PROFILE.md or broad requirements just to raise coverage. If repeated attempts fail, halt and show the user the exact output. Put the compact compliance trailer from specreg comply, or equivalent finish_task evidence, in the commit message body; do not report the task done until it passes.",
    {
      self_assessed_score: z.number().optional().describe("Your honest 0-100 estimate of how fully the work satisfies the specs."),
      project_type: z.string().optional().describe("Project type name. Defaults to the repo's configured type."),
      repo: z.string().optional().describe("Repo/project identity. Defaults to SPECREG_REPO when set."),
      project_id: z.string().optional().describe("Explicit SpecRegistry project id."),
    },
    async ({ self_assessed_score, project_type, repo, project_id }) => {
      const type = project_type ?? defaultType;
      return text(
        await api(opts.server, opts.token, "/api/v1/ai/compliance-check", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            self_assessed_score,
            project_type: type,
            project_id,
            repo: project_id ? undefined : (repo ?? defaultRepo),
          }),
        })
      );
    }
  );

  server.tool(
    "report_spec_feedback",
    "Report an ambiguity, contradiction, or outdated guidance in a specification, OR (error_type: missing_guidance) a pure coverage gap where resolve_guidance found nothing at all — no spec_id needed for a gap, just project_type plus languages and/or topic. Use this instead of guessing or inventing a standard.",
    {
      spec_id: z.string().optional().describe("The spec's id (from get_specs results). Omit for error_type 'missing_guidance'."),
      error_type: z.enum(["ambiguity", "contradiction", "outdated", "missing_guidance"]),
      description: z.string().describe("What is wrong or missing, specifically, and what you needed instead"),
      context_code_snippet: z.string().optional().describe("Relevant code or spec excerpt"),
      agent_identifier: z.string().optional().describe("Your model/agent name"),
      project_type: z.string().optional().describe("Required for 'missing_guidance' when spec_id is omitted. Defaults to the repo's configured type."),
      languages: z.array(z.string()).optional().describe("For 'missing_guidance': languages with no coverage, e.g. ['Go', 'Rust']."),
      topic: z.string().optional().describe("For 'missing_guidance': the uncovered domain/topic, e.g. 'authentication'."),
    },
    async (input) => {
      const project_type = input.project_type ?? defaultType;
      const created = await api(opts.server, opts.token, "/api/v1/ai/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...input,
          project_type,
          agent_identifier: input.agent_identifier ?? "mcp-agent",
        }),
      });
      return text(created);
    }
  );

  server.tool(
    "get_audit_prompt",
    "Fetch a reverse-conformance audit prompt for a governed spec. Use this before auditing whether code follows a spec's intent and requirements.",
    {
      spec_id: z.string().describe("Spec id from get_specs/search_specs results."),
      use_llm: z.boolean().optional().describe("Ask the registry server LLM to improve the prompt when enabled."),
    },
    async ({ spec_id, use_llm }) => {
      const suffix = use_llm ? "?use_llm=true" : "";
      return text(await api(opts.server, opts.token, `/api/v1/automation/audit-prompt/${encodeURIComponent(spec_id)}${suffix}`));
    }
  );

  await server.connect(new StdioServerTransport());
}
