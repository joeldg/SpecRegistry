import type { FastifyInstance } from "fastify";
import type { Spec } from "@specregistry/shared";
import { now, uuid } from "../db.js";
import { HttpError, requireProjectType, requireString } from "../helpers.js";
import { actorFrom, recordAudit } from "../lib/auditLog.js";
import { recordUsage } from "../lib/events.js";
import { runLlmText } from "../lib/llm.js";
import { detectSpecGaps, deterministicSpecDraft, purposePrompt, PURPOSE_TEMPLATES } from "../lib/specAutomation.js";

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function requirePurpose(id: string) {
  const purpose = PURPOSE_TEMPLATES.find((item) => item.id === id || item.filename.toLowerCase() === id.toLowerCase());
  if (!purpose) throw new HttpError(404, `Unknown spec purpose: ${id}`);
  return purpose;
}

export async function automationRoutes(app: FastifyInstance): Promise<void> {
  app.get("/spec-purposes", async () => PURPOSE_TEMPLATES);

  app.post("/spec-gaps", async (req) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const projectTypeName = requireString(body, "project_type");
    const pt = requireProjectType(app.db, projectTypeName);
    const tree = typeof body.tree === "string" ? body.tree : "";
    const existingSpecs =
      stringArray(body.existing_specs).length > 0
        ? stringArray(body.existing_specs)
        : (app.db
            .prepare("SELECT filename FROM specs WHERE project_type_id = ? OR project_type_id IN (SELECT id FROM project_types WHERE scope = 'global')")
            .all(pt.id) as Array<{ filename: string }>).map((row) => row.filename);
    recordUsage(app.db, "stub_prompts", pt.id, "spec-gaps");
    return {
      project_type: pt.name,
      gaps: detectSpecGaps({
        tree,
        existingSpecs,
        detectedLanguages: stringArray(body.detected_languages),
      }),
    };
  });

  app.post("/spec-generation/preview", async (req) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const projectTypeName = requireString(body, "project_type");
    const purpose = requirePurpose(requireString(body, "purpose"));
    const pt = requireProjectType(app.db, projectTypeName);
    const tree = typeof body.tree === "string" ? body.tree : "";
    const detectedLanguages = stringArray(body.detected_languages);
    const prompt = purposePrompt({
      purpose,
      projectType: pt.name,
      tree,
      detectedLanguages,
      extraContext: typeof body.extra_context === "string" ? body.extra_context : undefined,
    });
    const useLlm = body.use_llm === true;
    const generated = useLlm
      ? await runLlmText(app.db, {
          system: "You generate complete Markdown specification documents. Output only Markdown.",
          user: prompt,
        })
      : null;
    return {
      project_type: pt.name,
      purpose,
      filename: purpose.filename,
      prompt,
      content: generated?.text ?? deterministicSpecDraft({ purpose, projectType: pt.name, tree, detectedLanguages }),
      model: generated?.model ?? null,
      provider: generated?.provider ?? null,
    };
  });

  app.post("/spec-generation/draft", async (req, reply) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const projectTypeName = requireString(body, "project_type");
    const purpose = requirePurpose(requireString(body, "purpose"));
    const pt = requireProjectType(app.db, projectTypeName);
    const filename = typeof body.filename === "string" && body.filename.trim() ? body.filename.trim() : purpose.filename;
    const content = requireString(body, "content");
    const updatedBy = typeof body.updated_by === "string" && body.updated_by.trim() ? body.updated_by.trim() : "spec-generation";
    const duplicate = app.db
      .prepare("SELECT id FROM specs WHERE project_type_id = ? AND project_id IS NULL AND filename = ?")
      .get(pt.id, filename);
    if (duplicate) throw new HttpError(409, `Spec ${filename} already exists for ${pt.name}`);
    const id = uuid();
    const ts = now();
    app.db
      .prepare(
        `INSERT INTO specs (id, project_type_id, project_id, filename, current_version, status, content, updated_by, created_at, updated_at)
         VALUES (?, ?, NULL, ?, '0.1.0', 'draft', ?, ?, ?, ?)`
      )
      .run(id, pt.id, filename, content, updatedBy, ts, ts);
    recordAudit(app.db, {
      actor: actorFrom(req, updatedBy),
      action: "spec.generated_draft",
      target_type: "spec",
      target_id: id,
      summary: `Generated draft ${filename} from purpose ${purpose.id}`,
      detail: { project_type: pt.name, purpose: purpose.id },
    });
    reply.code(201);
    return app.db.prepare("SELECT * FROM specs WHERE id = ?").get(id) as Spec;
  });
}
