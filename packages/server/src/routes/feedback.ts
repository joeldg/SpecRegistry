import type { FastifyInstance } from "fastify";
import type { AgentFeedback, FeedbackErrorType, Spec } from "@specregistry/shared";
import { now, uuid } from "../db.js";
import { HttpError, requireOneOf, requireProjectType, requireSpec, requireString } from "../helpers.js";
import { draftFix } from "../lib/aifix.js";
import { auditCodebase, runEfficacy, type AuditInput } from "../lib/audit.js";
import { createChangeRequest } from "../lib/changes.js";
import { uuid as makeId } from "../db.js";
import { dispatchWebhooks, recordUsage } from "../lib/events.js";
import { searchSpecs } from "../lib/search.js";

export async function feedbackRoutes(app: FastifyInstance): Promise<void> {
  // Agent-facing onboarding guide: feed this markdown to an agent so it knows how
  // to configure and use the SpecRegistry MCP server in a codebase.
  app.get("/ai/mcp-guide/:projectType?", async (req) => {
    const { projectType } = req.params as { projectType?: string };
    const pt = projectType ? requireProjectType(app.db, projectType) : undefined;
    const serverUrl = "http://localhost:4000";
    const mcpConfig = {
      mcpServers: {
        specregistry: {
          command: "specreg-mcp",
          args: [],
          env: {
            SPECREG_SERVER: serverUrl,
            ...(pt ? { SPECREG_PROJECT_TYPE: pt.name } : {}),
          },
        },
      },
    };
    const content = `# SpecRegistry MCP Skill

Use this skill when working in a repository governed by SpecRegistry.

## Configure MCP

Add this server to the repository's MCP configuration:

\`\`\`json
${JSON.stringify(mcpConfig, null, 2)}
\`\`\`

If the project type is not preconfigured, call \`list_project_types\` first and choose the best match.

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
    return {
      filename: "SPECREGISTRY_MCP_SKILL.md",
      project_type: pt?.name ?? null,
      mcp_config: mcpConfig,
      content,
    };
  });

  // Agent-facing read endpoint: latest published specs (global + project type), full content.
  app.get("/ai/specs/:projectType", async (req) => {
    const { projectType } = req.params as { projectType: string };
    const pt = requireProjectType(app.db, projectType);
    recordUsage(app.db, "agent_read", pt.id);
    const specs = app.db
      .prepare(
        `SELECT s.*, pt.name AS project_type_name, pt.scope AS project_type_scope
         FROM specs s JOIN project_types pt ON pt.id = s.project_type_id
         WHERE s.status IN ('published', 'pending_review') AND (pt.id = ? OR pt.scope = 'global')
         ORDER BY pt.scope = 'global' DESC, s.filename`
      )
      .all(pt.id);
    return { project_type: pt.name, specs };
  });

  // Telemetry ingestion: agents flag ambiguities/contradictions for human review.
  app.post("/ai/feedback", async (req, reply) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const specId = requireString(body, "spec_id");
    const agentIdentifier = requireString(body, "agent_identifier");
    const description = requireString(body, "description");
    const errorType = requireOneOf(body, "error_type", [
      "ambiguity",
      "contradiction",
      "outdated",
    ] as const satisfies readonly FeedbackErrorType[]);
    const spec: Spec = requireSpec(app.db, specId);
    const specVersion = typeof body.spec_version === "string" ? body.spec_version : spec.current_version;

    const id = uuid();
    app.db
      .prepare(
        `INSERT INTO agent_feedback (id, spec_id, spec_version, agent_identifier, error_type, context_code_snippet, description, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?)`
      )
      .run(
        id,
        spec.id,
        specVersion,
        agentIdentifier,
        errorType,
        (body.context_code_snippet as string) ?? null,
        description,
        now()
      );
    await dispatchWebhooks(
      app.db,
      "feedback.created",
      `${agentIdentifier} flagged ${spec.filename}@${specVersion}: ${errorType}`,
      { feedback_id: id, spec_id: spec.id, filename: spec.filename, error_type: errorType }
    );
    reply.code(201);
    return app.db.prepare("SELECT * FROM agent_feedback WHERE id = ?").get(id);
  });

  // Lexical RAG endpoint: section-level search over published specs.
  app.get("/ai/search", async (req) => {
    const { q, project_type } = req.query as { q?: string; project_type?: string };
    if (!q || !q.trim()) throw new HttpError(400, "Missing query parameter: q");
    const pt = project_type ? requireProjectType(app.db, project_type) : undefined;
    recordUsage(app.db, "search", pt?.id, q);
    return { query: q, results: searchSpecs(app.db, q, pt?.id) };
  });

  // Close the loop: have Claude draft a revision that resolves the feedback,
  // then submit it through the normal review workflow as a pending change request.
  app.post("/ai/feedback/:id/draft-fix", async (req, reply) => {
    const { id } = req.params as { id: string };
    const feedback = app.db.prepare("SELECT * FROM agent_feedback WHERE id = ?").get(id) as
      | AgentFeedback
      | undefined;
    if (!feedback) throw new HttpError(404, `Unknown feedback: ${id}`);
    if (feedback.status === "resolved") throw new HttpError(409, "Feedback is already resolved");
    const spec = requireSpec(app.db, feedback.spec_id);
    if (spec.status === "pending_review") {
      throw new HttpError(409, "Spec already has a pending change request; review it first");
    }

    const revised = await draftFix(spec, feedback);
    const cr = createChangeRequest(app.db, {
      spec,
      proposedContent: revised,
      // Resolving a contradiction changes guidance; clarifications are patches.
      versionDelta: feedback.error_type === "ambiguity" ? "patch" : "minor",
      proposedBy: `claude-draft (for ${feedback.agent_identifier})`,
      summary: `AI-drafted fix for ${feedback.error_type} feedback: ${feedback.description.slice(0, 120)}`,
    });
    app.db.prepare("UPDATE agent_feedback SET status = 'acknowledged' WHERE id = ? AND status = 'open'").run(id);
    await dispatchWebhooks(app.db, "review.submitted", `${spec.filename}: AI-drafted fix awaiting review`, {
      change_request_id: cr.id,
      spec_id: spec.id,
      filename: spec.filename,
      feedback_id: id,
    });
    reply.code(201);
    return cr;
  });

  app.get("/ai/feedback", async (req) => {
    const { status } = req.query as { status?: string };
    const base = `
      SELECT f.*, s.filename, s.current_version, pt.name AS project_type_name
      FROM agent_feedback f
      JOIN specs s ON s.id = f.spec_id
      JOIN project_types pt ON pt.id = s.project_type_id
    `;
    if (status) {
      return app.db.prepare(`${base} WHERE f.status = ? ORDER BY f.created_at DESC`).all(status);
    }
    return app.db.prepare(`${base} ORDER BY f.created_at DESC`).all();
  });

  // Reverse conformance: does a codebase snapshot follow its governed specs?
  app.post("/ai/audit", async (req) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const pt = requireProjectType(app.db, requireString(body, "project_type"));
    const tree = requireString(body, "tree");
    const files = Array.isArray(body.files)
      ? (body.files as AuditInput["files"]).filter(
          (f) => typeof f?.path === "string" && typeof f?.content === "string"
        )
      : [];
    const findings = await auditCodebase(app.db, pt, { tree, files });
    return { project_type: pt.name, findings, finding_count: findings.length };
  });

  // Spec efficacy A/B: does this spec measurably change agent output for a task?
  app.post("/ai/efficacy", async (req, reply) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const spec = requireSpec(app.db, requireString(body, "spec_id"));
    const task = requireString(body, "task_prompt");
    const result = await runEfficacy(spec.content, spec.filename, task);
    const id = makeId();
    app.db
      .prepare(
        `INSERT INTO efficacy_runs (id, spec_id, task_prompt, score_with, score_without, improved, rationale, model, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        spec.id,
        task,
        result.score_with,
        result.score_without,
        result.improved ? 1 : 0,
        result.rationale,
        result.model,
        now()
      );
    reply.code(201);
    return app.db.prepare("SELECT * FROM efficacy_runs WHERE id = ?").get(id);
  });

  // Spec authors triage alerts: open -> acknowledged -> resolved.
  app.post("/ai/feedback/:id/status", async (req) => {
    const { id } = req.params as { id: string };
    const body = (req.body ?? {}) as Record<string, unknown>;
    const status = requireOneOf(body, "status", ["open", "acknowledged", "resolved"] as const);
    const existing = app.db.prepare("SELECT id FROM agent_feedback WHERE id = ?").get(id);
    if (!existing) throw new HttpError(404, `Unknown feedback: ${id}`);
    app.db.prepare("UPDATE agent_feedback SET status = ? WHERE id = ?").run(status, id);
    return app.db.prepare("SELECT * FROM agent_feedback WHERE id = ?").get(id);
  });
}
