import type { FastifyInstance } from "fastify";
import { createHash } from "node:crypto";
import { now, uuid } from "../db.js";
import { actorFrom, recordAudit } from "../lib/auditLog.js";
import { HttpError, requireString } from "../helpers.js";

type RiskLevel = "safe" | "restricted";
type SkillStatus = "active" | "disabled";
type SourceType = "github_repo" | "github_search" | "local_upload" | "builtin_pack" | "manual";
type SourceStatus = "active" | "paused" | "archived";
type TrustDecision = "trusted" | "unreviewed" | "blocked";
type CandidateType = "agent_skill" | "spec_seed" | "project_type_template" | "reference_only" | "unsafe" | "unknown";
type CandidateStatus = "candidate" | "converted" | "rejected" | "archived";

function slugValue(value: unknown): string {
  const slug = String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (!slug) throw new HttpError(400, "skill slug is required");
  if (slug.length > 80) throw new HttpError(400, "skill slug must be 80 characters or fewer");
  return slug;
}

function riskValue(value: unknown, fallback: RiskLevel = "safe"): RiskLevel {
  const risk = value ?? fallback;
  if (risk !== "safe" && risk !== "restricted") throw new HttpError(400, "risk_level must be safe or restricted");
  return risk;
}

function statusValue(value: unknown, fallback: SkillStatus = "active"): SkillStatus {
  const status = value ?? fallback;
  if (status !== "active" && status !== "disabled") throw new HttpError(400, "status must be active or disabled");
  return status;
}

function bounded(value: string, field: string, max: number): string {
  if (value.length > max) throw new HttpError(400, `${field} must be ${max} characters or fewer`);
  return value;
}

function enumValue<T extends string>(value: unknown, allowed: readonly T[], field: string, fallback: T): T {
  const next = value ?? fallback;
  if (typeof next !== "string" || !allowed.includes(next as T)) {
    throw new HttpError(400, `${field} must be one of: ${allowed.join(", ")}`);
  }
  return next as T;
}

function optionalBounded(value: unknown, field: string, max: number): string | null {
  if (value == null || String(value).trim() === "") return null;
  return bounded(String(value).trim(), field, max);
}

function contentHash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function jsonList(values: string[]): string {
  return JSON.stringify([...new Set(values)].sort());
}

function detectCandidateSignals(content: string) {
  const commands = Array.from(content.matchAll(/\b(?:npm|pnpm|yarn|pip|uv|curl|wget|git|docker|kubectl|terraform|rm|sudo)\s+[^\n`]+/gi)).map((m) => m[0].trim()).slice(0, 25);
  const network = Array.from(content.matchAll(/\bhttps?:\/\/[^\s)>'"]+/gi)).map((m) => m[0]).slice(0, 25);
  const secrets = Array.from(content.matchAll(/\b(?:api[_-]?key|token|secret|password|credential|bearer)\b/gi)).map((m) => m[0].toLowerCase()).slice(0, 25);
  const risky = commands.length > 0 || network.length > 0 || secrets.length > 0;
  return {
    commands,
    network,
    secrets,
    risk_level: risky ? "restricted" as RiskLevel : "safe" as RiskLevel,
    risk_summary: risky ? "Candidate mentions commands, network targets, or secret-like terms; review before conversion." : "No obvious command, network, or secret signals detected.",
  };
}

export async function skillRoutes(app: FastifyInstance): Promise<void> {
  app.get("/skills", async (req) => {
    const { include_disabled } = req.query as { include_disabled?: string };
    if (include_disabled === "true" && req.user && req.user.role !== "admin") {
      throw new HttpError(403, "Admin role required to view disabled skills");
    }
    return app.db
      .prepare(`SELECT * FROM agent_skills ${include_disabled === "true" ? "" : "WHERE status = 'active'"} ORDER BY built_in DESC, name`)
      .all();
  });

  app.post("/skills", async (req, reply) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const id = uuid();
    const slug = slugValue(body.slug ?? body.name);
    const name = bounded(requireString(body, "name"), "name", 120);
    const description = bounded(requireString(body, "description"), "description", 500);
    const instructions = bounded(requireString(body, "instructions"), "instructions", 20000);
    const risk = riskValue(body.risk_level);
    const status = statusValue(body.status);
    if (app.db.prepare("SELECT id FROM agent_skills WHERE slug = ?").get(slug)) {
      throw new HttpError(409, `Agent skill already exists: ${slug}`);
    }
    const ts = now();
    app.db.prepare(
      `INSERT INTO agent_skills (id, slug, name, description, instructions, risk_level, status, built_in, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
    ).run(id, slug, name, description, instructions, risk, status, ts, ts);
    recordAudit(app.db, { actor: actorFrom(req, "settings"), action: "skill.created", target_type: "agent_skill", target_id: id, summary: `Agent skill created: ${name}`, detail: { slug, risk_level: risk, status } });
    reply.code(201);
    return app.db.prepare("SELECT * FROM agent_skills WHERE id = ?").get(id);
  });

  app.put("/skills/:id", async (req) => {
    const { id } = req.params as { id: string };
    const existing = app.db.prepare("SELECT * FROM agent_skills WHERE id = ?").get(id) as Record<string, unknown> | undefined;
    if (!existing) throw new HttpError(404, `Unknown agent skill: ${id}`);
    const body = (req.body ?? {}) as Record<string, unknown>;
    const name = bounded(typeof body.name === "string" && body.name.trim() ? body.name.trim() : String(existing.name), "name", 120);
    const description = bounded(typeof body.description === "string" && body.description.trim() ? body.description.trim() : String(existing.description), "description", 500);
    const instructions = bounded(typeof body.instructions === "string" && body.instructions.trim() ? body.instructions.trim() : String(existing.instructions), "instructions", 20000);
    const risk = riskValue(body.risk_level, existing.risk_level as RiskLevel);
    const status = statusValue(body.status, existing.status as SkillStatus);
    app.db.prepare("UPDATE agent_skills SET name = ?, description = ?, instructions = ?, risk_level = ?, status = ?, updated_at = ? WHERE id = ?")
      .run(name, description, instructions, risk, status, now(), id);
    recordAudit(app.db, { actor: actorFrom(req, "settings"), action: "skill.updated", target_type: "agent_skill", target_id: id, summary: `Agent skill updated: ${name}`, detail: { slug: existing.slug, risk_level: risk, status } });
    return app.db.prepare("SELECT * FROM agent_skills WHERE id = ?").get(id);
  });

  app.delete("/skills/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const existing = app.db.prepare("SELECT * FROM agent_skills WHERE id = ?").get(id) as { name: string; built_in: number } | undefined;
    if (!existing) throw new HttpError(404, `Unknown agent skill: ${id}`);
    if (existing.built_in) throw new HttpError(409, "Built-in skills can be disabled but not deleted");
    app.db.prepare("DELETE FROM agent_skills WHERE id = ?").run(id);
    recordAudit(app.db, { actor: actorFrom(req, "settings"), action: "skill.deleted", target_type: "agent_skill", target_id: id, summary: `Agent skill deleted: ${existing.name}` });
    reply.code(204).send();
  });

  app.get("/skills/sources", async () => {
    return app.db.prepare("SELECT * FROM skill_sources ORDER BY updated_at DESC, url").all();
  });

  app.post("/skills/sources", async (req, reply) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const id = uuid();
    const url = bounded(requireString(body, "url"), "url", 1000);
    const provider = bounded(String(body.provider ?? "github").trim() || "github", "provider", 80);
    const sourceType = enumValue<SourceType>(body.source_type, ["github_repo", "github_search", "local_upload", "builtin_pack", "manual"], "source_type", "github_repo");
    const status = enumValue<SourceStatus>(body.status, ["active", "paused", "archived"], "status", "active");
    const trust = enumValue<TrustDecision>(body.trust_decision, ["trusted", "unreviewed", "blocked"], "trust_decision", "unreviewed");
    const ts = now();
    if (app.db.prepare("SELECT id FROM skill_sources WHERE url = ?").get(url)) {
      throw new HttpError(409, `Skill source already exists: ${url}`);
    }
    app.db.prepare(
      `INSERT INTO skill_sources
        (id, url, provider, source_type, license, default_branch, last_fetched_commit, last_scan_at,
         status, trust_decision, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      url,
      provider,
      sourceType,
      optionalBounded(body.license, "license", 120),
      optionalBounded(body.default_branch, "default_branch", 120),
      optionalBounded(body.last_fetched_commit, "last_fetched_commit", 120),
      optionalBounded(body.last_scan_at, "last_scan_at", 80),
      status,
      trust,
      optionalBounded(body.notes, "notes", 2000),
      ts,
      ts
    );
    recordAudit(app.db, { actor: actorFrom(req, "settings"), action: "skill_source.created", target_type: "skill_source", target_id: id, summary: `Skill source created: ${url}`, detail: { provider, source_type: sourceType, trust_decision: trust } });
    reply.code(201);
    return app.db.prepare("SELECT * FROM skill_sources WHERE id = ?").get(id);
  });

  app.put("/skills/sources/:id", async (req) => {
    const { id } = req.params as { id: string };
    const existing = app.db.prepare("SELECT * FROM skill_sources WHERE id = ?").get(id) as Record<string, unknown> | undefined;
    if (!existing) throw new HttpError(404, `Unknown skill source: ${id}`);
    const body = (req.body ?? {}) as Record<string, unknown>;
    const provider = optionalBounded(body.provider, "provider", 80) ?? String(existing.provider);
    const sourceType = enumValue<SourceType>(body.source_type, ["github_repo", "github_search", "local_upload", "builtin_pack", "manual"], "source_type", existing.source_type as SourceType);
    const status = enumValue<SourceStatus>(body.status, ["active", "paused", "archived"], "status", existing.status as SourceStatus);
    const trust = enumValue<TrustDecision>(body.trust_decision, ["trusted", "unreviewed", "blocked"], "trust_decision", existing.trust_decision as TrustDecision);
    app.db.prepare(
      `UPDATE skill_sources
       SET provider = ?, source_type = ?, license = ?, default_branch = ?, last_fetched_commit = ?,
           last_scan_at = ?, status = ?, trust_decision = ?, notes = ?, updated_at = ?
       WHERE id = ?`
    ).run(
      provider,
      sourceType,
      optionalBounded(body.license, "license", 120) ?? existing.license,
      optionalBounded(body.default_branch, "default_branch", 120) ?? existing.default_branch,
      optionalBounded(body.last_fetched_commit, "last_fetched_commit", 120) ?? existing.last_fetched_commit,
      optionalBounded(body.last_scan_at, "last_scan_at", 80) ?? existing.last_scan_at,
      status,
      trust,
      optionalBounded(body.notes, "notes", 2000) ?? existing.notes,
      now(),
      id
    );
    recordAudit(app.db, { actor: actorFrom(req, "settings"), action: "skill_source.updated", target_type: "skill_source", target_id: id, summary: `Skill source updated: ${existing.url}`, detail: { status, trust_decision: trust } });
    return app.db.prepare("SELECT * FROM skill_sources WHERE id = ?").get(id);
  });

  app.get("/skills/candidates", async (req) => {
    const { source_id, status } = req.query as { source_id?: string; status?: string };
    const where: string[] = [];
    const params: unknown[] = [];
    if (source_id) {
      where.push("source_id = ?");
      params.push(source_id);
    }
    if (status) {
      where.push("status = ?");
      params.push(status);
    }
    return app.db
      .prepare(`SELECT * FROM skill_candidates ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY updated_at DESC, proposed_name`)
      .all(...params);
  });

  app.post("/skills/candidates", async (req, reply) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const rawContent = bounded(requireString(body, "raw_content"), "raw_content", 100000);
    const source = body.source_id
      ? app.db.prepare("SELECT * FROM skill_sources WHERE id = ?").get(String(body.source_id)) as Record<string, unknown> | undefined
      : undefined;
    if (body.source_id && !source) throw new HttpError(404, `Unknown skill source: ${body.source_id}`);
    const proposedName = bounded(requireString(body, "proposed_name"), "proposed_name", 160);
    const proposedSlug = slugValue(body.proposed_slug ?? proposedName);
    const detected = detectCandidateSignals(rawContent);
    const candidateType = enumValue<CandidateType>(body.candidate_type, ["agent_skill", "spec_seed", "project_type_template", "reference_only", "unsafe", "unknown"], "candidate_type", "unknown");
    const status = enumValue<CandidateStatus>(body.status, ["candidate", "converted", "rejected", "archived"], "status", "candidate");
    const id = uuid();
    const ts = now();
    app.db.prepare(
      `INSERT INTO skill_candidates
        (id, source_id, source_url, source_path, source_commit, detected_format, raw_content_hash,
         raw_content, license, category, candidate_type, proposed_name, proposed_slug, risk_level,
         risk_summary, detected_commands, detected_network, detected_secrets, classifier_notes,
         status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      source ? source.id : null,
      optionalBounded(body.source_url, "source_url", 1000) ?? source?.url ?? null,
      optionalBounded(body.source_path, "source_path", 500),
      optionalBounded(body.source_commit, "source_commit", 120) ?? source?.last_fetched_commit ?? null,
      optionalBounded(body.detected_format, "detected_format", 120) ?? "unknown",
      contentHash(rawContent),
      rawContent,
      optionalBounded(body.license, "license", 120) ?? source?.license ?? null,
      optionalBounded(body.category, "category", 120),
      candidateType,
      proposedName,
      proposedSlug,
      body.risk_level ? riskValue(body.risk_level) : detected.risk_level,
      optionalBounded(body.risk_summary, "risk_summary", 1000) ?? detected.risk_summary,
      jsonList(detected.commands),
      jsonList(detected.network),
      jsonList(detected.secrets),
      optionalBounded(body.classifier_notes, "classifier_notes", 4000) ?? "",
      status,
      ts,
      ts
    );
    recordAudit(app.db, { actor: actorFrom(req, "settings"), action: "skill_candidate.created", target_type: "skill_candidate", target_id: id, summary: `Skill candidate created: ${proposedName}`, detail: { source_id: source?.id ?? null, candidate_type: candidateType, status } });
    reply.code(201);
    return app.db.prepare("SELECT * FROM skill_candidates WHERE id = ?").get(id);
  });
}
