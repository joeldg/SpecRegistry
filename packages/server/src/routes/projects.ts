import type { FastifyInstance } from "fastify";
import { now, uuid } from "../db.js";
import { HttpError, requireProjectConsumer, requireProjectType, requireString } from "../helpers.js";
import { projectSpecCurrency } from "../lib/projectCurrency.js";

function projectRows(app: FastifyInstance, where = "", params: unknown[] = []) {
  const rows = app.db
    .prepare(
      `SELECT rc.*, pt.name AS project_type_name,
              COUNT(DISTINCT ps.id) AS project_spec_count,
              MAX(ctr.created_at) AS code_trace_reported_at,
              (SELECT COUNT(*) FROM agent_feedback f WHERE f.project_type_id = rc.project_type_id AND f.status = 'open') AS open_feedback_count
       FROM repo_consumers rc
       JOIN project_types pt ON pt.id = rc.project_type_id
       LEFT JOIN specs ps ON ps.project_id = rc.id AND ps.deleted_at IS NULL
       LEFT JOIN code_trace_reports ctr ON ctr.consumer_id = rc.id
       ${where}
       GROUP BY rc.id
       ORDER BY rc.last_seen_at DESC`
    )
    .all(...params);
  return (rows as Array<Record<string, unknown>>).map((row) => ({
    ...row,
    ...projectSpecCurrency(app.db, String(row.id), String(row.project_type_id)),
  }));
}

export async function projectRoutes(app: FastifyInstance): Promise<void> {
  app.get("/projects", async () => projectRows(app));

  app.post("/projects", async (req, reply) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const repo = requireString(body, "repo");
    const projectTypeId = requireString(body, "project_type_id");
    const pt = requireProjectType(app.db, projectTypeId);
    const existing = app.db
      .prepare("SELECT id FROM repo_consumers WHERE repo = ? AND project_type_id = ?")
      .get(repo, pt.id);
    if (existing) throw new HttpError(409, `Project already exists for ${repo} under ${pt.name}`);
    const id = uuid();
    const ts = now();
    app.db
      .prepare(
        `INSERT INTO repo_consumers
         (id, repo, branch, commit_sha, project_type_id, specs_path, manifest_path, source, first_seen_at, last_seen_at)
         VALUES (?, ?, ?, NULL, ?, ?, ?, 'dashboard', ?, ?)`
      )
      .run(
        id,
        repo,
        typeof body.branch === "string" && body.branch.trim() ? body.branch.trim() : null,
        pt.id,
        typeof body.specs_path === "string" && body.specs_path.trim() ? body.specs_path.trim() : "specs",
        typeof body.manifest_path === "string" && body.manifest_path.trim() ? body.manifest_path.trim() : "specs/.specregistry.json",
        ts,
        ts
      );
    reply.code(201);
    return requireProjectConsumer(app.db, id, pt.id);
  });

  app.get("/projects/:id", async (req) => {
    const { id } = req.params as { id: string };
    const rows = projectRows(app, "WHERE rc.id = ? OR rc.repo = ?", [id, id]);
    const project = rows[0] as Record<string, unknown> | undefined;
    if (!project) throw new HttpError(404, `Unknown project: ${id}`);
    return project;
  });
}
