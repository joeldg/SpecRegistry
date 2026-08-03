import type { FastifyInstance, FastifyRequest } from "fastify";
import { findProjectConsumer, HttpError, requireProjectType, requireString } from "../helpers.js";
import { now, uuid } from "../db.js";
import { actorFrom, recordAudit } from "../lib/auditLog.js";

interface SpecChange {
  filename: string;
  status: "added" | "modified" | "deleted";
  base_sha256?: string;
  sha256?: string;
  content?: string;
}

interface AgentStateRow {
  id: string;
  consumer_id: string;
  workspace_id: string;
  agent_identifier: string;
  branch: string | null;
  commit_sha: string | null;
  manifest_hash: string;
  spec_changes: string;
  created_at: string;
  updated_at: string;
}

function assertAgentScope(req: FastifyRequest, repo: string, projectTypeId: string): void {
  if (req.user?.role !== "agent") return;
  if (req.user.repo !== repo || req.user.project_type_id !== projectTypeId) {
    throw new HttpError(403, "Agent credentials are not authorized for this repository and project type");
  }
}

function parseChanges(value: unknown): SpecChange[] {
  if (!Array.isArray(value)) throw new HttpError(400, "spec_changes must be an array");
  if (value.length > 200) throw new HttpError(413, "agent state may contain at most 200 changed specs");
  return value.map((raw) => {
    const item = (raw ?? {}) as Record<string, unknown>;
    const filename = requireString(item, "filename");
    if (filename.includes("..") || filename.startsWith("/") || !filename.endsWith(".md")) {
      throw new HttpError(400, `Unsafe spec filename: ${filename}`);
    }
    const status = requireString(item, "status");
    if (!(["added", "modified", "deleted"] as const).includes(status as SpecChange["status"])) {
      throw new HttpError(400, `Invalid spec change status: ${status}`);
    }
    const content = typeof item.content === "string" ? item.content : undefined;
    if (content && Buffer.byteLength(content, "utf8") > 256 * 1024) {
      throw new HttpError(413, `Spec snapshot is too large: ${filename}`);
    }
    return {
      filename,
      status: status as SpecChange["status"],
      base_sha256: typeof item.base_sha256 === "string" ? item.base_sha256 : undefined,
      sha256: typeof item.sha256 === "string" ? item.sha256 : undefined,
      content,
    };
  });
}

function publicState(row: AgentStateRow) {
  return { ...row, spec_changes: JSON.parse(row.spec_changes) as SpecChange[] };
}

// @spec[DESIGN.md#server-design]
export async function agentStateRoutes(app: FastifyInstance): Promise<void> {
  app.get("/cli/agent-state", async (req) => {
    const query = req.query as { repo?: string; project_type?: string; exclude_workspace?: string };
    if (!query.repo || !query.project_type) throw new HttpError(400, "repo and project_type are required");
    const projectType = requireProjectType(app.db, query.project_type);
    const project = findProjectConsumer(app.db, query.repo, projectType.id);
    if (!project) throw new HttpError(404, "Project has not reported a manifest yet");
    assertAgentScope(req, project.repo, project.project_type_id);
    const rows = app.db.prepare(
      `SELECT * FROM agent_states
       WHERE consumer_id = ? AND (? IS NULL OR workspace_id <> ?)
       ORDER BY updated_at DESC`
    ).all(project.id, query.exclude_workspace ?? null, query.exclude_workspace ?? null) as AgentStateRow[];
    return rows.map(publicState);
  });

  app.post("/cli/agent-state", { bodyLimit: 2 * 1024 * 1024 }, async (req, reply) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const repo = requireString(body, "repo");
    const projectType = requireProjectType(app.db, requireString(body, "project_type"));
    const project = findProjectConsumer(app.db, repo, projectType.id);
    if (!project) throw new HttpError(404, "Project has not reported a manifest yet; run specreg sync first");
    assertAgentScope(req, project.repo, project.project_type_id);
    const workspaceId = requireString(body, "workspace_id");
    const agentIdentifier = requireString(body, "agent_identifier");
    const manifestHash = requireString(body, "manifest_hash");
    const changes = parseChanges(body.spec_changes);
    const ts = now();
    const existing = app.db.prepare(
      "SELECT id, created_at FROM agent_states WHERE consumer_id = ? AND workspace_id = ?"
    ).get(project.id, workspaceId) as { id: string; created_at: string } | undefined;
    const id = existing?.id ?? uuid();
    app.db.prepare(
      `INSERT OR REPLACE INTO agent_states
       (id, consumer_id, workspace_id, agent_identifier, branch, commit_sha, manifest_hash, spec_changes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      project.id,
      workspaceId,
      agentIdentifier,
      typeof body.branch === "string" ? body.branch : null,
      typeof body.commit_sha === "string" ? body.commit_sha : null,
      manifestHash,
      JSON.stringify(changes),
      existing?.created_at ?? ts,
      ts
    );
    recordAudit(app.db, {
      actor: actorFrom(req, agentIdentifier),
      action: "agent_state.reported",
      target_type: "project",
      target_id: project.id,
      summary: `Agent workspace state reported for ${repo}`,
      detail: { workspace_id: workspaceId, branch: body.branch ?? null, changed_specs: changes.map((change) => change.filename) },
    });
    reply.code(existing ? 200 : 201);
    return publicState(app.db.prepare("SELECT * FROM agent_states WHERE id = ?").get(id) as AgentStateRow);
  });
}
