import type { FastifyInstance } from "fastify";
import { now, uuid } from "../db.js";
import { requireProjectType, requireString, HttpError } from "../helpers.js";

export async function projectTypeRoutes(app: FastifyInstance): Promise<void> {
  app.get("/project-types", async () => {
    return app.db
      .prepare(
        `SELECT pt.*,
                SUM(CASE WHEN s.project_id IS NULL THEN 1 ELSE 0 END) AS spec_count,
                SUM(CASE WHEN s.project_id IS NOT NULL THEN 1 ELSE 0 END) AS project_spec_count,
                COUNT(DISTINCT rc.id) AS project_count,
                CASE
                  WHEN pt.scope = 'project_type'
                   AND COUNT(DISTINCT rc.id) <= 1
                   AND (
                     lower(pt.name) LIKE '%\\_%' ESCAPE '\\'
                     OR lower(pt.name) LIKE '%router%'
                     OR lower(pt.name) LIKE '%research%'
                   )
                  THEN 1 ELSE 0
                END AS project_type_smell
         FROM project_types pt
         LEFT JOIN specs s ON s.project_type_id = pt.id AND s.deleted_at IS NULL
         LEFT JOIN repo_consumers rc ON rc.project_type_id = pt.id
         GROUP BY pt.id
         ORDER BY pt.scope = 'global' DESC, pt.name`
      )
      .all();
  });

  app.post("/project-types", async (req, reply) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const name = requireString(body, "name");
    const duplicate = app.db
      .prepare("SELECT id FROM project_types WHERE name = ? COLLATE NOCASE")
      .get(name);
    if (duplicate) throw new HttpError(409, `Project type already exists: ${name}`);

    const id = uuid();
    const ts = now();
    app.db
      .prepare(
        `INSERT INTO project_types (id, name, scope, industry, description, created_at, updated_at)
         VALUES (?, ?, 'project_type', ?, ?, ?, ?)`
      )
      .run(id, name, (body.industry as string) ?? null, (body.description as string) ?? null, ts, ts);
    reply.code(201);
    return requireProjectType(app.db, id);
  });

  app.put("/project-types/:id", async (req) => {
    const { id } = req.params as { id: string };
    const existing = requireProjectType(app.db, id);
    const body = (req.body ?? {}) as Record<string, unknown>;
    app.db
      .prepare(
        `UPDATE project_types SET name = ?, industry = ?, description = ?, required_reviewers = ?, updated_at = ? WHERE id = ?`
      )
      .run(
        (body.name as string) ?? existing.name,
        (body.industry as string) ?? existing.industry,
        (body.description as string) ?? existing.description,
        Array.isArray(body.required_reviewers)
          ? JSON.stringify(body.required_reviewers)
          : ((existing as unknown as Record<string, unknown>).required_reviewers as string) ?? "[]",
        now(),
        existing.id
      );
    return requireProjectType(app.db, existing.id);
  });
}
