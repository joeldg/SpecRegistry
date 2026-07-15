import type { FastifyInstance } from "fastify";
import { createHash } from "node:crypto";
import { now, uuid, type Db } from "../db.js";
import { actorFrom, recordAudit } from "../lib/auditLog.js";
import { getAppKeyConfig } from "../lib/appKeys.js";
import { HttpError, requireString } from "../helpers.js";
import { renderSkillMarkdown, skillContentHash, type AgentSkillRecord } from "../lib/skills.js";

type RiskLevel = "safe" | "restricted";
type SkillStatus = "active" | "disabled";
type SourceType = "github_repo" | "github_search" | "local_upload" | "builtin_pack" | "manual";
type SourceStatus = "active" | "paused" | "archived";
type TrustDecision = "trusted" | "unreviewed" | "blocked";
type CandidateType = "agent_skill" | "spec_seed" | "project_type_template" | "reference_only" | "unsafe" | "unknown";
type CandidateStatus = "candidate" | "converted" | "rejected" | "archived";
type GateStatus = "pass" | "review" | "block" | "pending";
type SkillReviewAction = "update" | "enable" | "disable" | "delete";
type SkillAssignmentScope = "global" | "project_type" | "project";
type SkillSpecRelation = "related" | "governs" | "recommends" | "supports";

interface SkillSourceRecord {
  id: string;
  url: string;
  provider: string;
  source_type: SourceType;
  license: string | null;
  default_branch: string | null;
  last_fetched_commit: string | null;
  last_scan_at: string | null;
  status: SourceStatus;
  trust_decision: TrustDecision;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface CreatedCandidate {
  row: Record<string, unknown>;
  created: boolean;
}

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

function skillSelectWithVersion(where: string): string {
  return `SELECT ask.*,
                 asv.id AS version_id,
                 asv.version AS current_version,
                 asv.content_hash,
                 asv.created_at AS version_created_at
          FROM agent_skills ask
          LEFT JOIN agent_skill_versions asv ON asv.id = (
            SELECT id FROM agent_skill_versions latest
            WHERE latest.skill_id = ask.id
            ORDER BY latest.created_at DESC, latest.version DESC
            LIMIT 1
          )
          ${where}`;
}

function createSkillVersion(db: Db, skillId: string, actor: string, changelog: string): void {
  const skill = db.prepare("SELECT * FROM agent_skills WHERE id = ?").get(skillId) as AgentSkillRecord | undefined;
  if (!skill) return;
  const hash = skillContentHash(skill);
  const existing = db.prepare("SELECT id FROM agent_skill_versions WHERE skill_id = ? AND content_hash = ?").get(skillId, hash);
  if (existing) return;
  const count = db.prepare("SELECT COUNT(*) AS count FROM agent_skill_versions WHERE skill_id = ?").get(skillId) as { count: number };
  const version = count.count === 0 ? "1.0.0" : `1.0.${count.count}`;
  db.prepare(
    `INSERT INTO agent_skill_versions
      (id, skill_id, version, content_hash, name, description, instructions, risk_level, status, published_by, changelog, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(uuid(), skill.id, version, hash, skill.name, skill.description, skill.instructions, skill.risk_level, skill.status, actor, changelog, now());
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

function classifyCandidate(input: { content: string; source_path?: string | null; proposed_name?: string | null }) {
  const haystack = `${input.proposed_name ?? ""}\n${input.source_path ?? ""}\n${input.content}`.toLowerCase();
  const has = (pattern: RegExp) => pattern.test(haystack);
  if (has(/\b(ignore previous|jailbreak|exfiltrate|steal|disable safety|bypass approval|sudo rm|rm -rf|credential dump)\b/)) {
    return {
      candidate_type: "unsafe" as CandidateType,
      category: "security",
      notes: "Classified as unsafe because the material appears to request bypass, exfiltration, destructive commands, or safety evasion.",
    };
  }
  if (has(/\b(project type|project-type|baseline|template|starter kit|scaffold)\b/)) {
    return {
      candidate_type: "project_type_template" as CandidateType,
      category: "template",
      notes: "Classified as a project type template because it describes reusable baseline or template material.",
    };
  }
  if (has(/\b(requirement|requirements|shall|must|specification|acceptance criteria|api contract|data contract)\b/)) {
    return {
      candidate_type: "spec_seed" as CandidateType,
      category: "requirements",
      notes: "Classified as a spec seed because it reads like requirements, constraints, or acceptance criteria.",
    };
  }
  if (has(/\b(skill\.md|agent skill|workflow|procedure|playbook|when to use|steps|use this skill|agent should)\b/)) {
    return {
      candidate_type: "agent_skill" as CandidateType,
      category: "workflow",
      notes: "Classified as an agent skill because it describes an agent procedure or workflow.",
    };
  }
  if (has(/\b(readme|awesome|catalog|index|reference|examples|resources|links)\b/)) {
    return {
      candidate_type: "reference_only" as CandidateType,
      category: "reference",
      notes: "Classified as reference-only material because it appears to list resources or examples rather than govern agent behavior.",
    };
  }
  return {
    candidate_type: "unknown" as CandidateType,
    category: "unknown",
    notes: "No deterministic classifier rule matched; keep as unknown until reviewed.",
  };
}

function evaluateCandidateGates(input: {
  content: string;
  content_hash: string;
  candidate_type: CandidateType;
  license?: string | null;
  detected: ReturnType<typeof detectCandidateSignals>;
  duplicate_count?: number;
}) {
  const estimatedTokens = Math.max(1, Math.ceil(input.content.length / 4));
  const lower = input.content.toLowerCase();
  const gateResults: Array<{ gate: string; status: GateStatus; detail: string }> = [];
  const add = (gate: string, status: GateStatus, detail: string) => gateResults.push({ gate, status, detail });
  const injectionPattern = /\b(ignore previous|ignore all previous|jailbreak|developer mode|bypass approval|disable safety|exfiltrate|steal credentials|credential dump)\b/;

  add(
    "prompt_injection",
    injectionPattern.test(lower) || input.candidate_type === "unsafe" ? "block" : "pass",
    injectionPattern.test(lower) || input.candidate_type === "unsafe"
      ? "Possible prompt-injection, bypass, exfiltration, or destructive intent detected."
      : "No obvious prompt-injection pattern detected."
  );
  add(
    "command_intent",
    input.detected.commands.length ? "review" : "pass",
    input.detected.commands.length ? `Mentions ${input.detected.commands.length} command-like instruction(s).` : "No command-like instructions detected."
  );
  add(
    "network_intent",
    input.detected.network.length ? "review" : "pass",
    input.detected.network.length ? `Mentions ${input.detected.network.length} network URL(s).` : "No network URLs detected."
  );
  add(
    "secrets",
    input.detected.secrets.length ? "review" : "pass",
    input.detected.secrets.length ? `Mentions ${input.detected.secrets.length} secret-like term(s).` : "No secret-like terms detected."
  );
  add(
    "license",
    input.license ? "pass" : "review",
    input.license ? `License recorded: ${input.license}.` : "No license recorded; reviewer must verify before conversion."
  );
  add(
    "token_budget",
    estimatedTokens > 8000 ? "review" : "pass",
    estimatedTokens > 8000 ? `Large candidate estimated at ${estimatedTokens} tokens.` : `Estimated at ${estimatedTokens} tokens.`
  );
  add(
    "duplicate",
    (input.duplicate_count ?? 0) > 0 ? "review" : "pass",
    (input.duplicate_count ?? 0) > 0 ? `Matches ${input.duplicate_count} existing candidate content hash(es).` : "No duplicate content hash detected."
  );

  const gateStatus: GateStatus = gateResults.some((gate) => gate.status === "block")
    ? "block"
    : gateResults.some((gate) => gate.status === "review")
      ? "review"
      : "pass";
  return { gate_status: gateStatus, gate_results: JSON.stringify(gateResults) };
}

function createSkillCandidateRecord(db: Db, input: {
  raw_content: string;
  proposed_name: string;
  proposed_slug?: string;
  source?: SkillSourceRecord | null;
  source_url?: string | null;
  source_path?: string | null;
  source_commit?: string | null;
  detected_format?: string | null;
  license?: string | null;
  category?: string | null;
  candidate_type?: CandidateType | null;
  risk_level?: RiskLevel | null;
  risk_summary?: string | null;
  classifier_notes?: string | null;
  status?: CandidateStatus;
}): CreatedCandidate {
  const rawContent = bounded(input.raw_content, "raw_content", 100000);
  const proposedName = bounded(input.proposed_name, "proposed_name", 160);
  const proposedSlug = slugValue(input.proposed_slug ?? proposedName);
  const sourcePath = optionalBounded(input.source_path, "source_path", 500);
  const hash = contentHash(rawContent);
  const existing = db
    .prepare(
      `SELECT * FROM skill_candidates
       WHERE COALESCE(source_id, '') = COALESCE(?, '')
         AND COALESCE(source_path, '') = COALESCE(?, '')
         AND raw_content_hash = ?`
    )
    .get(input.source?.id ?? null, sourcePath, hash) as Record<string, unknown> | undefined;
  if (existing) return { row: existing, created: false };
  const detected = detectCandidateSignals(rawContent);
  const classification = classifyCandidate({
    content: rawContent,
    source_path: sourcePath,
    proposed_name: proposedName,
  });
  const candidateType = input.candidate_type ?? classification.candidate_type;
  const status = input.status ?? "candidate";
  const id = uuid();
  const ts = now();
  const duplicate = db.prepare("SELECT COUNT(*) AS n FROM skill_candidates WHERE raw_content_hash = ?").get(hash) as { n: number };
  const license = optionalBounded(input.license, "license", 120) ?? input.source?.license ?? null;
  const gates = evaluateCandidateGates({
    content: rawContent,
    content_hash: hash,
    candidate_type: candidateType,
    license,
    detected,
    duplicate_count: duplicate.n,
  });
  db.prepare(
    `INSERT INTO skill_candidates
      (id, source_id, source_url, source_path, source_commit, detected_format, raw_content_hash,
       raw_content, license, category, candidate_type, proposed_name, proposed_slug, risk_level,
       risk_summary, detected_commands, detected_network, detected_secrets, gate_status, gate_results, classifier_notes,
       status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.source?.id ?? null,
    optionalBounded(input.source_url, "source_url", 1000) ?? input.source?.url ?? null,
    sourcePath,
    optionalBounded(input.source_commit, "source_commit", 120) ?? input.source?.last_fetched_commit ?? null,
    optionalBounded(input.detected_format, "detected_format", 120) ?? "unknown",
    hash,
    rawContent,
    license,
    optionalBounded(input.category, "category", 120) ?? classification.category,
    candidateType,
    proposedName,
    proposedSlug,
    input.risk_level ?? (candidateType === "unsafe" ? "restricted" : detected.risk_level),
    optionalBounded(input.risk_summary, "risk_summary", 1000) ?? detected.risk_summary,
    jsonList(detected.commands),
    jsonList(detected.network),
    jsonList(detected.secrets),
    gates.gate_status,
    gates.gate_results,
    optionalBounded(input.classifier_notes, "classifier_notes", 4000) ?? classification.notes,
    status,
    ts,
    ts
  );
  return { row: db.prepare("SELECT * FROM skill_candidates WHERE id = ?").get(id) as Record<string, unknown>, created: true };
}

function parseGithubRepoUrl(url: string): { owner: string; repo: string } | null {
  const trimmed = url.trim().replace(/\.git$/i, "");
  const ssh = trimmed.match(/^git@github\.com:([^/]+)\/([^/]+)$/i);
  if (ssh) return { owner: ssh[1], repo: ssh[2] };
  const https = trimmed.match(/^https?:\/\/github\.com\/([^/]+)\/([^/#?]+)(?:[/#?].*)?$/i);
  if (https) return { owner: https[1], repo: https[2] };
  const shorthand = trimmed.match(/^([^/\s]+)\/([^/\s]+)$/);
  if (shorthand) return { owner: shorthand[1], repo: shorthand[2] };
  return null;
}

function githubHeaders(token?: string): HeadersInit {
  return {
    accept: "application/vnd.github+json",
    "user-agent": "specregistry",
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  };
}

async function githubJson<T>(path: string, token?: string): Promise<T> {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: githubHeaders(token),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`GitHub API ${path} failed: ${res.status} ${await res.text()}`);
  return await res.json() as T;
}

function encodeGithubPath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

function skillCandidateFormat(path: string): string | null {
  if (/^\.codex\/skills\/[^/]+\/SKILL\.md$/i.test(path)) return "codex_skill_markdown";
  if (/(^|\/)SKILL\.md$/i.test(path)) return "skill_markdown";
  if (/^\.claude\/agents\/[^/]+\.md$/i.test(path)) return "claude_agent_markdown";
  if (/^agents\/[^/]+\.md$/i.test(path)) return "agent_markdown";
  if (/(^|\/)AGENTS\.md$/i.test(path)) return "agents_markdown";
  if (/(^|\/)(skill|skills|agent-skills)\.(json|ya?ml)$/i.test(path)) return "skill_manifest";
  if (/^\.spec\/skills\/manifest\.json$/i.test(path)) return "skill_manifest";
  if (/(^|\/)README\.md$/i.test(path)) return "readme_markdown";
  return null;
}

function shouldImportScannedContent(path: string, content: string): boolean {
  const format = skillCandidateFormat(path);
  if (!format) return false;
  if (format !== "readme_markdown") return true;
  return /\b(agent skill|skills?|workflow|playbook|procedure|when to use|use this skill|agent should)\b/i.test(content);
}

function proposedNameFromPath(path: string): string {
  const parts = path.split("/");
  const file = parts[parts.length - 1];
  const basis = /^SKILL\.md$/i.test(file) && parts.length > 1 ? parts[parts.length - 2] : file.replace(/\.(md|ya?ml|json)$/i, "");
  return basis
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .slice(0, 120);
}

async function scanGithubSkillSource(source: SkillSourceRecord, token?: string): Promise<Array<{
  path: string;
  sha: string;
  content: string;
  detected_format: string;
  proposed_name: string;
}>> {
  const parsed = parseGithubRepoUrl(source.url);
  if (!parsed) throw new HttpError(400, `Source is not a GitHub repository URL: ${source.url}`);
  const repo = await githubJson<{ default_branch: string; pushed_at?: string }>(`/repos/${parsed.owner}/${parsed.repo}`, token);
  const ref = source.default_branch || repo.default_branch;
  const tree = await githubJson<{ tree: Array<{ path: string; type: string; sha: string; size?: number }>; truncated?: boolean }>(
    `/repos/${parsed.owner}/${parsed.repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`,
    token
  );
  if (tree.truncated) throw new Error("GitHub tree response was truncated; narrow the source before scanning");
  const matches = tree.tree
    .filter((entry) => entry.type === "blob" && skillCandidateFormat(entry.path) && (entry.size ?? 0) <= 100000)
    .slice(0, 50);
  const scanned: Array<{ path: string; sha: string; content: string; detected_format: string; proposed_name: string }> = [];
  for (const entry of matches) {
    const contentResponse = await githubJson<{ content: string; encoding: string; sha: string }>(
      `/repos/${parsed.owner}/${parsed.repo}/contents/${encodeGithubPath(entry.path)}?ref=${encodeURIComponent(ref)}`,
      token
    );
    if (contentResponse.encoding !== "base64") continue;
    const content = Buffer.from(contentResponse.content.replace(/\s+/g, ""), "base64").toString("utf8");
    const detectedFormat = skillCandidateFormat(entry.path);
    if (!detectedFormat || !shouldImportScannedContent(entry.path, content)) continue;
    scanned.push({
      path: entry.path,
      sha: contentResponse.sha || entry.sha,
      content,
      detected_format: detectedFormat,
      proposed_name: proposedNameFromPath(entry.path),
    });
  }
  return scanned;
}

function normalizeCandidateInstructions(candidate: {
  raw_content: string;
  source_url: string | null;
  source_path: string | null;
  source_commit: string | null;
  classifier_notes: string;
  gate_status: string;
}): string {
  const sourceLines = [
    candidate.source_url ? `- Source URL: ${candidate.source_url}` : null,
    candidate.source_path ? `- Source path: ${candidate.source_path}` : null,
    candidate.source_commit ? `- Source commit: ${candidate.source_commit}` : null,
    `- Gate status: ${candidate.gate_status}`,
  ].filter(Boolean).join("\n");
  return `This draft was converted from an untrusted marketplace candidate. Review and edit it before enabling the skill.

## Source Provenance

${sourceLines}

## Conversion Notes

${candidate.classifier_notes || "No classifier notes were recorded."}

## Draft Procedure

${candidate.raw_content.trim()}`;
}

function skillReviewActionValue(value: unknown): SkillReviewAction {
  return enumValue<SkillReviewAction>(value, ["update", "enable", "disable", "delete"], "action", "update");
}

function proposedStatusForAction(action: SkillReviewAction, fallback: SkillStatus): SkillStatus {
  if (action === "enable") return "active";
  if (action === "disable" || action === "delete") return "disabled";
  return fallback;
}

function assignmentScopeValue(value: unknown): SkillAssignmentScope {
  return enumValue<SkillAssignmentScope>(value, ["global", "project_type", "project"], "scope", "global");
}

function skillSpecRelationValue(value: unknown): SkillSpecRelation {
  return enumValue<SkillSpecRelation>(value, ["related", "governs", "recommends", "supports"], "relation", "related");
}

export async function skillRoutes(app: FastifyInstance): Promise<void> {
  app.get("/skills", async (req) => {
    const { include_disabled } = req.query as { include_disabled?: string };
    if (include_disabled === "true" && req.user && req.user.role !== "admin") {
      throw new HttpError(403, "Admin role required to view disabled skills");
    }
    return app.db
      .prepare(`${skillSelectWithVersion(include_disabled === "true" ? "" : "WHERE ask.status = 'active'")} ORDER BY ask.built_in DESC, ask.name`)
      .all();
  });

  app.get("/skills/:id/detail", async (req) => {
    const { id } = req.params as { id: string };
    const skill = app.db.prepare(skillSelectWithVersion("WHERE ask.id = ?")).get(id) as AgentSkillRecord | undefined;
    if (!skill) throw new HttpError(404, `Unknown agent skill: ${id}`);
    const versions = app.db
      .prepare(
        `SELECT id, version, content_hash, name, description, risk_level, status, published_by, changelog, created_at
         FROM agent_skill_versions
         WHERE skill_id = ?
         ORDER BY created_at DESC, version DESC`
      )
      .all(id);
    const assignments = app.db
      .prepare(
        `SELECT sa.*, pt.name AS project_type_name, rc.repo AS project_repo
         FROM skill_assignments sa
         LEFT JOIN project_types pt ON pt.id = sa.project_type_id
         LEFT JOIN repo_consumers rc ON rc.id = sa.project_id
         WHERE sa.skill_id = ?
         ORDER BY sa.scope, pt.name, rc.repo`
      )
      .all(id);
    const related_specs = app.db
      .prepare(
        `SELECT ssl.*, s.filename, s.current_version, s.status AS spec_status,
                pt.name AS project_type_name, rc.repo AS project_repo
         FROM skill_spec_links ssl
         JOIN specs s ON s.id = ssl.spec_id
         JOIN project_types pt ON pt.id = s.project_type_id
         LEFT JOIN repo_consumers rc ON rc.id = s.project_id
         WHERE ssl.skill_id = ?
         ORDER BY s.filename, ssl.section_anchor`
      )
      .all(id);
    const reviews = app.db
      .prepare(
        `SELECT id, action, summary, status, proposed_by, reviewed_by, reviewed_at, created_at, updated_at
         FROM skill_change_requests
         WHERE skill_id = ?
         ORDER BY created_at DESC
         LIMIT 20`
      )
      .all(id);
    const source_candidate = skill.source_candidate_id
      ? app.db
          .prepare(
            `SELECT id, source_url, source_path, source_commit, detected_format, candidate_type,
                    proposed_name, proposed_slug, risk_level, risk_summary, gate_status,
                    classifier_notes, status, created_at, updated_at
             FROM skill_candidates
             WHERE id = ?`
          )
          .get(skill.source_candidate_id)
      : null;
    const source = skill.source_url
      ? app.db
          .prepare(
            `SELECT id, url, provider, source_type, license, last_fetched_commit,
                    last_scan_at, status, trust_decision, notes
             FROM skill_sources
             WHERE url = ?`
          )
          .get(skill.source_url)
      : null;
    const consumers = app.db
      .prepare(
        `SELECT DISTINCT rc.id, rc.repo, pt.name AS project_type_name, sa.scope, rc.last_seen_at
         FROM repo_consumers rc
         JOIN project_types pt ON pt.id = rc.project_type_id
         JOIN skill_assignments sa ON sa.skill_id = ?
         WHERE sa.scope = 'global'
            OR (sa.scope = 'project_type' AND sa.project_type_id = rc.project_type_id)
            OR (sa.scope = 'project' AND sa.project_id = rc.id)
         ORDER BY rc.last_seen_at DESC, rc.repo
         LIMIT 100`
      )
      .all(id);
    return {
      skill,
      markdown: renderSkillMarkdown(skill),
      versions,
      assignments,
      related_specs,
      reviews,
      source_candidate,
      source,
      consumers,
    };
  });

  app.get("/skills/assignments", async () => {
    return app.db
      .prepare(
        `SELECT sa.*, ask.slug AS skill_slug, ask.name AS skill_name, ask.risk_level, ask.status AS skill_status,
                pt.name AS project_type_name, rc.repo AS project_repo
         FROM skill_assignments sa
         JOIN agent_skills ask ON ask.id = sa.skill_id
         LEFT JOIN project_types pt ON pt.id = sa.project_type_id
         LEFT JOIN repo_consumers rc ON rc.id = sa.project_id
         ORDER BY sa.scope, ask.name`
      )
      .all();
  });

  app.post("/skills/assignments", async (req, reply) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const skillId = requireString(body, "skill_id");
    const skill = app.db.prepare("SELECT id, slug, status FROM agent_skills WHERE id = ?").get(skillId) as { id: string; slug: string; status: SkillStatus } | undefined;
    if (!skill) throw new HttpError(404, `Unknown agent skill: ${skillId}`);
    const scope = assignmentScopeValue(body.scope);
    const projectTypeId = scope === "project_type" ? bounded(requireString(body, "project_type_id"), "project_type_id", 120) : null;
    const projectId = scope === "project" ? bounded(requireString(body, "project_id"), "project_id", 120) : null;
    if (projectTypeId && !app.db.prepare("SELECT id FROM project_types WHERE id = ?").get(projectTypeId)) {
      throw new HttpError(404, `Unknown project type: ${projectTypeId}`);
    }
    if (projectId && !app.db.prepare("SELECT id FROM repo_consumers WHERE id = ?").get(projectId)) {
      throw new HttpError(404, `Unknown project: ${projectId}`);
    }
    const existing = app.db
      .prepare(
        `SELECT id FROM skill_assignments
         WHERE skill_id = ? AND scope = ?
           AND COALESCE(project_type_id, '') = COALESCE(?, '')
           AND COALESCE(project_id, '') = COALESCE(?, '')`
      )
      .get(skillId, scope, projectTypeId, projectId) as { id: string } | undefined;
    if (existing) throw new HttpError(409, "Skill assignment already exists");
    const id = uuid();
    app.db.prepare(
      `INSERT INTO skill_assignments (id, skill_id, scope, project_type_id, project_id, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(id, skillId, scope, projectTypeId, projectId, actorFrom(req, "settings"), now());
    recordAudit(app.db, { actor: actorFrom(req, "settings"), action: "skill_assignment.created", target_type: "agent_skill", target_id: skillId, summary: `Skill assigned: ${skill.slug} (${scope})`, detail: { scope, project_type_id: projectTypeId, project_id: projectId } });
    reply.code(201);
    return app.db.prepare("SELECT * FROM skill_assignments WHERE id = ?").get(id);
  });

  app.delete("/skills/assignments/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const existing = app.db.prepare("SELECT * FROM skill_assignments WHERE id = ?").get(id) as { skill_id: string; scope: string } | undefined;
    if (!existing) throw new HttpError(404, `Unknown skill assignment: ${id}`);
    app.db.prepare("DELETE FROM skill_assignments WHERE id = ?").run(id);
    recordAudit(app.db, { actor: actorFrom(req, "settings"), action: "skill_assignment.deleted", target_type: "agent_skill", target_id: existing.skill_id, summary: `Skill assignment removed (${existing.scope})` });
    reply.code(204).send();
  });

  app.get("/skills/spec-links", async (req) => {
    const { skill_id } = req.query as { skill_id?: string };
    const where = skill_id ? "WHERE ssl.skill_id = ?" : "";
    const params = skill_id ? [skill_id] : [];
    return app.db
      .prepare(
        `SELECT ssl.*, ask.slug AS skill_slug, ask.name AS skill_name,
                s.filename, s.current_version, pt.name AS project_type_name
         FROM skill_spec_links ssl
         JOIN agent_skills ask ON ask.id = ssl.skill_id
         JOIN specs s ON s.id = ssl.spec_id
         JOIN project_types pt ON pt.id = s.project_type_id
         ${where}
         ORDER BY ask.name, s.filename, ssl.section_anchor`
      )
      .all(...params);
  });

  app.post("/skills/spec-links", async (req, reply) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const skillId = requireString(body, "skill_id");
    const specId = requireString(body, "spec_id");
    const skill = app.db.prepare("SELECT id, slug FROM agent_skills WHERE id = ?").get(skillId) as { id: string; slug: string } | undefined;
    if (!skill) throw new HttpError(404, `Unknown agent skill: ${skillId}`);
    const spec = app.db.prepare("SELECT id, filename FROM specs WHERE id = ?").get(specId) as { id: string; filename: string } | undefined;
    if (!spec) throw new HttpError(404, `Unknown spec: ${specId}`);
    const sectionAnchor = optionalBounded(body.section_anchor, "section_anchor", 160);
    const relation = skillSpecRelationValue(body.relation);
    const existing = app.db
      .prepare(
        `SELECT id FROM skill_spec_links
         WHERE skill_id = ? AND spec_id = ?
           AND COALESCE(section_anchor, '') = COALESCE(?, '')
           AND relation = ?`
      )
      .get(skillId, specId, sectionAnchor, relation) as { id: string } | undefined;
    if (existing) throw new HttpError(409, "Skill spec link already exists");
    const id = uuid();
    app.db.prepare(
      `INSERT INTO skill_spec_links (id, skill_id, spec_id, section_anchor, relation, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(id, skillId, specId, sectionAnchor, relation, actorFrom(req, "settings"), now());
    recordAudit(app.db, {
      actor: actorFrom(req, "settings"),
      action: "skill_spec_link.created",
      target_type: "agent_skill",
      target_id: skillId,
      summary: `Skill linked to spec: ${skill.slug} -> ${spec.filename}`,
      detail: { spec_id: specId, section_anchor: sectionAnchor, relation },
    });
    reply.code(201);
    return app.db
      .prepare(
        `SELECT ssl.*, ask.slug AS skill_slug, ask.name AS skill_name,
                s.filename, s.current_version, pt.name AS project_type_name
         FROM skill_spec_links ssl
         JOIN agent_skills ask ON ask.id = ssl.skill_id
         JOIN specs s ON s.id = ssl.spec_id
         JOIN project_types pt ON pt.id = s.project_type_id
         WHERE ssl.id = ?`
      )
      .get(id);
  });

  app.delete("/skills/spec-links/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const existing = app.db.prepare("SELECT * FROM skill_spec_links WHERE id = ?").get(id) as { skill_id: string; spec_id: string; relation: string } | undefined;
    if (!existing) throw new HttpError(404, `Unknown skill spec link: ${id}`);
    app.db.prepare("DELETE FROM skill_spec_links WHERE id = ?").run(id);
    recordAudit(app.db, {
      actor: actorFrom(req, "settings"),
      action: "skill_spec_link.deleted",
      target_type: "agent_skill",
      target_id: existing.skill_id,
      summary: `Skill spec link removed (${existing.relation})`,
      detail: { spec_id: existing.spec_id },
    });
    reply.code(204).send();
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
    createSkillVersion(app.db, id, actorFrom(req, "settings"), "Initial governed skill version.");
    recordAudit(app.db, { actor: actorFrom(req, "settings"), action: "skill.created", target_type: "agent_skill", target_id: id, summary: `Agent skill created: ${name}`, detail: { slug, risk_level: risk, status } });
    reply.code(201);
    return app.db.prepare(skillSelectWithVersion("WHERE ask.id = ?")).get(id);
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
    createSkillVersion(app.db, id, actorFrom(req, "settings"), "Direct skill update.");
    recordAudit(app.db, { actor: actorFrom(req, "settings"), action: "skill.updated", target_type: "agent_skill", target_id: id, summary: `Agent skill updated: ${name}`, detail: { slug: existing.slug, risk_level: risk, status } });
    return app.db.prepare(skillSelectWithVersion("WHERE ask.id = ?")).get(id);
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

  app.post("/skills/sources/:id/scan", async (req) => {
    const { id } = req.params as { id: string };
    const source = app.db.prepare("SELECT * FROM skill_sources WHERE id = ?").get(id) as SkillSourceRecord | undefined;
    if (!source) throw new HttpError(404, `Unknown skill source: ${id}`);
    if (source.status !== "active") throw new HttpError(409, "Only active skill sources can be scanned");
    if (source.trust_decision === "blocked") throw new HttpError(409, "Blocked skill sources cannot be scanned");
    if (source.source_type !== "github_repo") throw new HttpError(409, "Only github_repo sources can be scanned in this release");

    const token = getAppKeyConfig(app.db).github_token || undefined;
    const scanned = await scanGithubSkillSource(source, token);
    const candidates: Array<{ id: unknown; source_path: unknown; proposed_name: unknown; candidate_type: unknown; gate_status: unknown; created: boolean }> = [];
    for (const item of scanned) {
      const candidate = createSkillCandidateRecord(app.db, {
        source,
        raw_content: item.content,
        proposed_name: item.proposed_name,
        source_path: item.path,
        source_commit: item.sha,
        detected_format: item.detected_format,
        classifier_notes: `Scanned from GitHub source ${source.url}.`,
      });
      candidates.push({
        id: candidate.row.id,
        source_path: candidate.row.source_path,
        proposed_name: candidate.row.proposed_name,
        candidate_type: candidate.row.candidate_type,
        gate_status: candidate.row.gate_status,
        created: candidate.created,
      });
    }
    const created = candidates.filter((candidate) => candidate.created).length;
    const skipped = candidates.length - created;
    const ts = now();
    app.db.prepare("UPDATE skill_sources SET last_scan_at = ?, updated_at = ? WHERE id = ?").run(ts, ts, id);
    recordAudit(app.db, {
      actor: actorFrom(req, "settings"),
      action: "skill_source.scanned",
      target_type: "skill_source",
      target_id: id,
      summary: `Skill source scanned: ${source.url}`,
      detail: { scanned: scanned.length, created, skipped },
    });
    return {
      source_id: id,
      scanned: scanned.length,
      created,
      skipped,
      candidates,
    };
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
    const source = body.source_id
      ? app.db.prepare("SELECT * FROM skill_sources WHERE id = ?").get(String(body.source_id)) as SkillSourceRecord | undefined
      : undefined;
    if (body.source_id && !source) throw new HttpError(404, `Unknown skill source: ${body.source_id}`);
    const candidateType = body.candidate_type
      ? enumValue<CandidateType>(body.candidate_type, ["agent_skill", "spec_seed", "project_type_template", "reference_only", "unsafe", "unknown"], "candidate_type", "unknown")
      : null;
    const status = enumValue<CandidateStatus>(body.status, ["candidate", "converted", "rejected", "archived"], "status", "candidate");
    const created = createSkillCandidateRecord(app.db, {
      source,
      raw_content: requireString(body, "raw_content"),
      proposed_name: requireString(body, "proposed_name"),
      proposed_slug: body.proposed_slug == null ? undefined : String(body.proposed_slug),
      source_url: body.source_url == null ? null : String(body.source_url),
      source_path: body.source_path == null ? null : String(body.source_path),
      source_commit: body.source_commit == null ? null : String(body.source_commit),
      detected_format: body.detected_format == null ? null : String(body.detected_format),
      license: body.license == null ? null : String(body.license),
      category: body.category == null ? null : String(body.category),
      candidate_type: candidateType,
      risk_level: body.risk_level ? riskValue(body.risk_level) : null,
      risk_summary: body.risk_summary == null ? null : String(body.risk_summary),
      classifier_notes: body.classifier_notes == null ? null : String(body.classifier_notes),
      status,
    });
    if (!created.created) throw new HttpError(409, "Skill candidate already exists for this source path and content hash");
    const row = created.row;
    recordAudit(app.db, { actor: actorFrom(req, "settings"), action: "skill_candidate.created", target_type: "skill_candidate", target_id: String(row.id), summary: `Skill candidate created: ${row.proposed_name}`, detail: { source_id: source?.id ?? null, candidate_type: row.candidate_type, status } });
    reply.code(201);
    return row;
  });

  app.post("/skills/candidates/:id/classify", async (req) => {
    const { id } = req.params as { id: string };
    const existing = app.db.prepare("SELECT * FROM skill_candidates WHERE id = ?").get(id) as
      | { raw_content: string; raw_content_hash: string; proposed_name: string; source_path: string | null; license: string | null }
      | undefined;
    if (!existing) throw new HttpError(404, `Unknown skill candidate: ${id}`);
    const detected = detectCandidateSignals(existing.raw_content);
    const classification = classifyCandidate({
      content: existing.raw_content,
      source_path: existing.source_path,
      proposed_name: existing.proposed_name,
    });
    const duplicate = app.db.prepare("SELECT COUNT(*) AS n FROM skill_candidates WHERE raw_content_hash = ? AND id <> ?").get(existing.raw_content_hash, id) as { n: number };
    const gates = evaluateCandidateGates({
      content: existing.raw_content,
      content_hash: existing.raw_content_hash,
      candidate_type: classification.candidate_type,
      license: existing.license,
      detected,
      duplicate_count: duplicate.n,
    });
    app.db.prepare(
      `UPDATE skill_candidates
       SET candidate_type = ?, category = ?, risk_level = ?, risk_summary = ?,
           detected_commands = ?, detected_network = ?, detected_secrets = ?,
           gate_status = ?, gate_results = ?, classifier_notes = ?, updated_at = ?
       WHERE id = ?`
    ).run(
      classification.candidate_type,
      classification.category,
      classification.candidate_type === "unsafe" ? "restricted" : detected.risk_level,
      detected.risk_summary,
      jsonList(detected.commands),
      jsonList(detected.network),
      jsonList(detected.secrets),
      gates.gate_status,
      gates.gate_results,
      classification.notes,
      now(),
      id
    );
    recordAudit(app.db, { actor: actorFrom(req, "settings"), action: "skill_candidate.classified", target_type: "skill_candidate", target_id: id, summary: `Skill candidate classified: ${existing.proposed_name}`, detail: { candidate_type: classification.candidate_type, category: classification.category } });
    return app.db.prepare("SELECT * FROM skill_candidates WHERE id = ?").get(id);
  });

  app.post("/skills/candidates/:id/gates", async (req) => {
    const { id } = req.params as { id: string };
    const existing = app.db.prepare("SELECT * FROM skill_candidates WHERE id = ?").get(id) as
      | { raw_content: string; raw_content_hash: string; candidate_type: CandidateType; license: string | null; proposed_name: string }
      | undefined;
    if (!existing) throw new HttpError(404, `Unknown skill candidate: ${id}`);
    const detected = detectCandidateSignals(existing.raw_content);
    const duplicate = app.db.prepare("SELECT COUNT(*) AS n FROM skill_candidates WHERE raw_content_hash = ? AND id <> ?").get(existing.raw_content_hash, id) as { n: number };
    const gates = evaluateCandidateGates({
      content: existing.raw_content,
      content_hash: existing.raw_content_hash,
      candidate_type: existing.candidate_type,
      license: existing.license,
      detected,
      duplicate_count: duplicate.n,
    });
    app.db.prepare(
      `UPDATE skill_candidates
       SET risk_level = ?, risk_summary = ?, detected_commands = ?, detected_network = ?,
           detected_secrets = ?, gate_status = ?, gate_results = ?, updated_at = ?
       WHERE id = ?`
    ).run(
      existing.candidate_type === "unsafe" ? "restricted" : detected.risk_level,
      detected.risk_summary,
      jsonList(detected.commands),
      jsonList(detected.network),
      jsonList(detected.secrets),
      gates.gate_status,
      gates.gate_results,
      now(),
      id
    );
    recordAudit(app.db, { actor: actorFrom(req, "settings"), action: "skill_candidate.gated", target_type: "skill_candidate", target_id: id, summary: `Skill candidate gates evaluated: ${existing.proposed_name}`, detail: { gate_status: gates.gate_status } });
    return app.db.prepare("SELECT * FROM skill_candidates WHERE id = ?").get(id);
  });

  app.post("/skills/candidates/:id/convert-skill", async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = (req.body ?? {}) as Record<string, unknown>;
    const candidate = app.db.prepare("SELECT * FROM skill_candidates WHERE id = ?").get(id) as
      | {
          id: string;
          source_url: string | null;
          source_path: string | null;
          source_commit: string | null;
          raw_content: string;
          raw_content_hash: string;
          proposed_name: string;
          proposed_slug: string;
          candidate_type: CandidateType;
          risk_level: RiskLevel;
          gate_status: GateStatus;
          classifier_notes: string;
          status: CandidateStatus;
        }
      | undefined;
    if (!candidate) throw new HttpError(404, `Unknown skill candidate: ${id}`);
    if (candidate.status === "converted") throw new HttpError(409, "Candidate has already been converted");
    if (candidate.candidate_type !== "agent_skill") {
      throw new HttpError(409, "Only agent_skill candidates can be converted into governed skills");
    }
    if (candidate.gate_status === "block") {
      throw new HttpError(409, "Blocked candidates cannot be converted into governed skills");
    }
    const slug = slugValue(body.slug ?? candidate.proposed_slug);
    if (app.db.prepare("SELECT id FROM agent_skills WHERE slug = ?").get(slug)) {
      throw new HttpError(409, `Agent skill already exists: ${slug}`);
    }
    const skillId = uuid();
    const ts = now();
    const name = bounded(
      typeof body.name === "string" && body.name.trim() ? body.name.trim() : candidate.proposed_name,
      "name",
      120
    );
    const description = bounded(
      typeof body.description === "string" && body.description.trim()
        ? body.description.trim()
        : `Draft skill converted from marketplace candidate ${candidate.proposed_slug}.`,
      "description",
      500
    );
    const instructions = bounded(
      typeof body.instructions === "string" && body.instructions.trim()
        ? body.instructions.trim()
        : normalizeCandidateInstructions(candidate),
      "instructions",
      20000
    );
    const risk = body.risk_level ? riskValue(body.risk_level) : candidate.risk_level;
    app.db.transaction(() => {
      app.db.prepare(
        `INSERT INTO agent_skills
          (id, slug, name, description, instructions, risk_level, status, built_in,
           source_candidate_id, source_url, source_path, source_commit, imported_at,
           transformed_by, transformation_note, upstream_content_hash, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'disabled', 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        skillId,
        slug,
        name,
        description,
        instructions,
        risk,
        candidate.id,
        candidate.source_url,
        candidate.source_path,
        candidate.source_commit,
        ts,
        actorFrom(req, "settings"),
        optionalBounded(body.transformation_note, "transformation_note", 1000) ?? "Deterministic candidate-to-skill draft conversion.",
        candidate.raw_content_hash,
        ts,
        ts
      );
      createSkillVersion(app.db, skillId, actorFrom(req, "settings"), "Initial governed skill version from marketplace candidate.");
      app.db.prepare("UPDATE skill_candidates SET status = 'converted', updated_at = ? WHERE id = ?").run(ts, id);
    })();
    recordAudit(app.db, {
      actor: actorFrom(req, "settings"),
      action: "skill_candidate.converted",
      target_type: "agent_skill",
      target_id: skillId,
      summary: `Skill candidate converted to disabled skill draft: ${name}`,
      detail: { candidate_id: id, slug, gate_status: candidate.gate_status },
    });
    reply.code(201);
    return app.db.prepare(skillSelectWithVersion("WHERE ask.id = ?")).get(skillId);
  });

  app.get("/skills/reviews", async (req) => {
    const { status } = req.query as { status?: string };
    const where = status ? "WHERE scr.status = ?" : "";
    const params = status ? [status] : [];
    return app.db
      .prepare(
        `SELECT scr.*, ask.slug AS skill_slug, ask.built_in AS skill_built_in
         FROM skill_change_requests scr
         JOIN agent_skills ask ON ask.id = scr.skill_id
         ${where}
         ORDER BY scr.created_at DESC`
      )
      .all(...params);
  });

  app.post("/skills/:id/reviews", async (req, reply) => {
    const { id } = req.params as { id: string };
    const existing = app.db.prepare("SELECT * FROM agent_skills WHERE id = ?").get(id) as
      | {
          id: string;
          name: string;
          description: string;
          instructions: string;
          risk_level: RiskLevel;
          status: SkillStatus;
        }
      | undefined;
    if (!existing) throw new HttpError(404, `Unknown agent skill: ${id}`);
    const pending = app.db.prepare("SELECT id FROM skill_change_requests WHERE skill_id = ? AND status = 'pending'").get(id);
    if (pending) throw new HttpError(409, "Skill already has a pending review");
    const body = (req.body ?? {}) as Record<string, unknown>;
    const action = skillReviewActionValue(body.action);
    const proposedName = bounded(typeof body.name === "string" && body.name.trim() ? body.name.trim() : existing.name, "name", 120);
    const proposedDescription = bounded(
      typeof body.description === "string" && body.description.trim() ? body.description.trim() : existing.description,
      "description",
      500
    );
    const proposedInstructions = bounded(
      typeof body.instructions === "string" && body.instructions.trim() ? body.instructions.trim() : existing.instructions,
      "instructions",
      20000
    );
    const proposedRisk = body.risk_level ? riskValue(body.risk_level) : existing.risk_level;
    const proposedStatus = proposedStatusForAction(action, body.status ? statusValue(body.status, existing.status) : existing.status);
    const reviewId = uuid();
    const ts = now();
    const summary = bounded(
      typeof body.summary === "string" && body.summary.trim() ? body.summary.trim() : `Propose ${action} for skill ${existing.name}.`,
      "summary",
      1000
    );
    app.db.prepare(
      `INSERT INTO skill_change_requests
        (id, skill_id, action, current_name, current_description, current_instructions,
         current_risk_level, current_status, proposed_name, proposed_description,
         proposed_instructions, proposed_risk_level, proposed_status, summary,
         status, proposed_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`
    ).run(
      reviewId,
      id,
      action,
      existing.name,
      existing.description,
      existing.instructions,
      existing.risk_level,
      existing.status,
      proposedName,
      proposedDescription,
      proposedInstructions,
      proposedRisk,
      proposedStatus,
      summary,
      actorFrom(req, "settings"),
      ts,
      ts
    );
    recordAudit(app.db, { actor: actorFrom(req, "settings"), action: "skill_review.submitted", target_type: "agent_skill", target_id: id, summary, detail: { review_id: reviewId, action } });
    reply.code(201);
    return app.db.prepare("SELECT * FROM skill_change_requests WHERE id = ?").get(reviewId);
  });

  app.post("/skills/reviews/:id/approve", async (req) => {
    const { id } = req.params as { id: string };
    const body = (req.body ?? {}) as Record<string, unknown>;
    const reviewedBy = bounded(requireString(body, "reviewed_by"), "reviewed_by", 160);
    const review = app.db.prepare("SELECT * FROM skill_change_requests WHERE id = ?").get(id) as
      | {
          id: string;
          skill_id: string;
          action: SkillReviewAction;
          proposed_by: string;
          proposed_name: string;
          proposed_description: string;
          proposed_instructions: string;
          proposed_risk_level: RiskLevel;
          proposed_status: SkillStatus;
          status: "pending" | "approved" | "rejected";
        }
      | undefined;
    if (!review) throw new HttpError(404, `Unknown skill review: ${id}`);
    if (review.status !== "pending") throw new HttpError(409, "Skill review is already closed");
    if (review.proposed_by.trim().toLowerCase() === reviewedBy.trim().toLowerCase()) {
      throw new HttpError(403, "Separation of duties: a different reviewer must approve this skill change.");
    }
    const ts = now();
    app.db.transaction(() => {
      if (review.action === "delete") {
        app.db.prepare("UPDATE agent_skills SET status = 'disabled', updated_at = ? WHERE id = ?").run(ts, review.skill_id);
      } else {
        app.db.prepare(
          `UPDATE agent_skills
           SET name = ?, description = ?, instructions = ?, risk_level = ?, status = ?, updated_at = ?
           WHERE id = ?`
        ).run(
          review.proposed_name,
          review.proposed_description,
          review.proposed_instructions,
          review.proposed_risk_level,
          review.proposed_status,
          ts,
          review.skill_id
        );
      }
      createSkillVersion(app.db, review.skill_id, reviewedBy, `Approved skill ${review.action} review.`);
      app.db.prepare("UPDATE skill_change_requests SET status = 'approved', reviewed_by = ?, reviewed_at = ?, updated_at = ? WHERE id = ?")
        .run(reviewedBy, ts, ts, id);
    })();
    recordAudit(app.db, { actor: actorFrom(req, reviewedBy), action: "skill_review.approved", target_type: "agent_skill", target_id: review.skill_id, summary: `${reviewedBy} approved skill ${review.action}`, detail: { review_id: id } });
    return app.db.prepare("SELECT * FROM skill_change_requests WHERE id = ?").get(id);
  });

  app.post("/skills/reviews/:id/reject", async (req) => {
    const { id } = req.params as { id: string };
    const body = (req.body ?? {}) as Record<string, unknown>;
    const reviewedBy = bounded(requireString(body, "reviewed_by"), "reviewed_by", 160);
    const review = app.db.prepare("SELECT * FROM skill_change_requests WHERE id = ?").get(id) as
      | { id: string; skill_id: string; action: SkillReviewAction; status: "pending" | "approved" | "rejected" }
      | undefined;
    if (!review) throw new HttpError(404, `Unknown skill review: ${id}`);
    if (review.status !== "pending") throw new HttpError(409, "Skill review is already closed");
    const ts = now();
    app.db.prepare("UPDATE skill_change_requests SET status = 'rejected', reviewed_by = ?, reviewed_at = ?, updated_at = ? WHERE id = ?")
      .run(reviewedBy, ts, ts, id);
    recordAudit(app.db, { actor: actorFrom(req, reviewedBy), action: "skill_review.rejected", target_type: "agent_skill", target_id: review.skill_id, summary: `${reviewedBy} rejected skill ${review.action}`, detail: { review_id: id } });
    return app.db.prepare("SELECT * FROM skill_change_requests WHERE id = ?").get(id);
  });
}
