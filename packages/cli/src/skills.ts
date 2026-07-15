import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fetchJson } from "./registry.js";

export interface AgentSkill {
  id: string;
  slug: string;
  name: string;
  description: string;
  instructions: string;
  risk_level: "safe" | "restricted";
  status: "active" | "disabled";
  built_in: number;
  version?: string;
  current_version?: string;
  version_id?: string | null;
  content_hash?: string | null;
  source_candidate_id?: string | null;
  source_url?: string | null;
  source_path?: string | null;
  source_commit?: string | null;
  upstream_content_hash?: string | null;
  created_at: string;
  updated_at: string;
}

export interface InstalledSkill {
  id?: string;
  slug?: string;
  name?: string;
  description?: string;
  risk_level?: "safe" | "restricted";
  version?: string;
  current_version?: string;
  version_id?: string | null;
  content_hash?: string | null;
}

export interface SkillManifest {
  source?: string;
  installed_at?: string;
  skills?: InstalledSkill[];
}

export interface SkillCurrencyReport {
  drift: boolean;
  installed: InstalledSkill[];
  up_to_date: InstalledSkill[];
  outdated: Array<{ local: InstalledSkill; remote: AgentSkill; reason: string }>;
  missing: AgentSkill[];
  unknown: InstalledSkill[];
}

interface AssignedSkillsResponse {
  project_type: string;
  project: string | null;
  skills: AgentSkill[];
}

export async function listAgentSkills(server: string, token?: string): Promise<AgentSkill[]> {
  return await fetchJson<AgentSkill[]>(`${server}/api/v1/skills`, undefined, token);
}

export async function listAssignedAgentSkills(server: string, projectType: string, token?: string): Promise<AgentSkill[]> {
  const result = await fetchJson<AssignedSkillsResponse>(`${server}/api/v1/ai/skills/${encodeURIComponent(projectType)}`, undefined, token);
  return result.skills;
}

export function resolveAgentSkills(catalog: AgentSkill[], selection?: string): AgentSkill[] {
  const normalized = selection?.trim().toLowerCase();
  if (normalized === "none" || normalized === "off") return [];
  if (normalized === "all") return catalog.filter((skill) => skill.status === "active");
  if (!normalized || normalized === "base" || normalized === "recommended") {
    return catalog.filter((skill) => skill.status === "active" && skill.built_in && skill.risk_level === "safe");
  }
  const selected: AgentSkill[] = [];
  for (const raw of normalized.split(",")) {
    const token = raw.trim();
    const index = Number(token);
    const skill = Number.isInteger(index) && index >= 1 && index <= catalog.length
      ? catalog[index - 1]
      : catalog.find((candidate) => candidate.slug.toLowerCase() === token || candidate.name.toLowerCase() === token);
    if (!skill) throw new Error(`Unknown agent skill "${raw.trim()}". Available: ${catalog.map((item) => item.slug).join(", ")}`);
    if (skill.status !== "active") throw new Error(`Agent skill is disabled: ${skill.slug}`);
    if (!selected.some((item) => item.id === skill.id)) selected.push(skill);
  }
  return selected;
}

export function installAgentSkills(skills: AgentSkill[], dir: string, force = false): void {
  const outDir = path.resolve(process.cwd(), dir);
  fs.mkdirSync(outDir, { recursive: true });
  for (const skill of skills) {
    const skillDir = path.join(outDir, skill.slug);
    const target = path.join(skillDir, "SKILL.md");
    if (fs.existsSync(target) && !force) {
      console.log(`Skipping ${skill.name}; ${path.relative(process.cwd(), target)} already exists. Use --force to refresh.`);
      continue;
    }
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(target, renderAgentSkill(skill), "utf8");
  }
  fs.writeFileSync(
    path.join(outDir, "manifest.json"),
    JSON.stringify({
      source: "specregistry",
      installed_at: new Date().toISOString(),
      skills: skills.map((skill) => ({
        id: skill.id,
        slug: skill.slug,
        name: skill.name,
        description: skill.description,
        risk_level: skill.risk_level,
        version: skill.current_version ?? skill.version ?? "1.0.0",
        version_id: skill.version_id ?? null,
        content_hash: skill.content_hash ?? sha256(renderAgentSkill(skill)),
      })),
    }, null, 2) + "\n",
    "utf8"
  );
  console.log(`Installed ${skills.length} agent skill(s) in ${path.relative(process.cwd(), outDir) || "."}/.`);
}

export function renderAgentSkill(skill: AgentSkill): string {
  return `---
name: ${skill.slug}
description: ${yamlString(skill.description)}
metadata:
  specregistry_id: ${skill.id}
  risk_level: ${skill.risk_level}
  source_candidate_id: ${skill.source_candidate_id ?? ""}
  source_url: ${skill.source_url ?? ""}
  source_path: ${skill.source_path ?? ""}
  source_commit: ${skill.source_commit ?? ""}
  upstream_content_hash: ${skill.upstream_content_hash ?? ""}
---

# ${skill.name}

${skill.description}

## Instructions

${skill.instructions.trim()}

## Safety Boundary

This skill is a governed operating procedure, not permission to take external or destructive
actions. Follow the agent host's approval policy, current published specifications, and the
principle of least privilege. Stop and ask when required authorization or intent is unclear.
`;
}

export function readSkillManifest(dir: string): SkillManifest | undefined {
  const manifestPath = path.resolve(process.cwd(), dir, "manifest.json");
  if (!fs.existsSync(manifestPath)) return undefined;
  return JSON.parse(fs.readFileSync(manifestPath, "utf8")) as SkillManifest;
}

export async function checkSkillCurrency(opts: {
  server: string;
  token?: string;
  projectType?: string;
  dir?: string;
}): Promise<SkillCurrencyReport> {
  const dir = opts.dir ?? ".spec/skills";
  const manifest = readSkillManifest(dir);
  const installed = manifest?.skills ?? [];
  const catalog = await listAgentSkills(opts.server, opts.token);
  const activeBySlug = new Map(catalog.filter((skill) => skill.status === "active").map((skill) => [skill.slug, skill]));
  let assigned: AgentSkill[] = [];
  if (opts.projectType) {
    try {
      assigned = await listAssignedAgentSkills(opts.server, opts.projectType, opts.token);
    } catch {
      assigned = [];
    }
  }
  const installedBySlug = new Map(installed.filter((skill) => skill.slug).map((skill) => [skill.slug as string, skill]));
  const up_to_date: InstalledSkill[] = [];
  const outdated: SkillCurrencyReport["outdated"] = [];
  const unknown: InstalledSkill[] = [];
  for (const local of installed) {
    if (!local.slug) continue;
    const remote = activeBySlug.get(local.slug);
    if (!remote) {
      unknown.push(local);
      continue;
    }
    const localVersion = local.version ?? local.current_version;
    const remoteVersion = remote.current_version ?? remote.version ?? "1.0.0";
    const remoteHash = remote.content_hash ?? sha256(renderAgentSkill(remote));
    const localFileHash = installedSkillFileHash(dir, local.slug);
    if (!local.content_hash || !localVersion) {
      outdated.push({ local, remote, reason: "local manifest is missing skill version/hash metadata" });
    } else if (local.content_hash && remoteHash && local.content_hash !== remoteHash) {
      outdated.push({ local, remote, reason: `registry hash changed (${local.content_hash.slice(0, 12)} -> ${remoteHash.slice(0, 12)})` });
    } else if (localVersion && remoteVersion && localVersion !== remoteVersion) {
      outdated.push({ local, remote, reason: `version changed (${localVersion} -> ${remoteVersion})` });
    } else if (localFileHash && local.content_hash && localFileHash !== local.content_hash) {
      outdated.push({ local, remote, reason: "local SKILL.md differs from installed manifest hash" });
    } else {
      up_to_date.push(local);
    }
  }
  const required = assigned.length ? assigned : [];
  const missing = required.filter((skill) => !installedBySlug.has(skill.slug));
  return {
    drift: outdated.length > 0 || missing.length > 0 || unknown.length > 0,
    installed,
    up_to_date,
    outdated,
    missing,
    unknown,
  };
}

export function printSkillCurrencyReport(report: SkillCurrencyReport): void {
  console.log("Agent skills:");
  console.log(`  Up to date:     ${report.up_to_date.length}`);
  for (const item of report.outdated) {
    const localVersion = item.local.version ?? item.local.current_version ?? "(unknown)";
    const remoteVersion = item.remote.current_version ?? item.remote.version ?? "1.0.0";
    console.log(`  OUTDATED:       ${item.local.slug}  ${localVersion} -> ${remoteVersion} (${item.reason})`);
  }
  for (const skill of report.missing) {
    console.log(`  MISSING LOCAL:  ${skill.slug}  (required ${skill.current_version ?? skill.version ?? "1.0.0"})`);
  }
  for (const skill of report.unknown) {
    console.log(`  LOCAL ONLY:     ${skill.slug ?? "(unknown)"}  (not active on the server)`);
  }
}

export async function syncAgentSkills(opts: {
  server: string;
  token?: string;
  projectType?: string;
  dir?: string;
  force?: boolean;
}): Promise<void> {
  const dir = opts.dir ?? ".spec/skills";
  const manifest = readSkillManifest(dir);
  const catalog = await listAgentSkills(opts.server, opts.token);
  const activeBySlug = new Map(catalog.filter((skill) => skill.status === "active").map((skill) => [skill.slug, skill]));
  let desiredSlugs = (manifest?.skills ?? []).map((skill) => skill.slug).filter((slug): slug is string => Boolean(slug));
  if (opts.projectType) {
    try {
      const assigned = await listAssignedAgentSkills(opts.server, opts.projectType, opts.token);
      if (assigned.length) desiredSlugs = assigned.map((skill) => skill.slug);
    } catch {
      // Fall back to the already-installed selection if the scoped discovery endpoint is unavailable.
    }
  }
  if (!desiredSlugs.length) {
    desiredSlugs = catalog.filter((skill) => skill.status === "active" && skill.built_in && skill.risk_level === "safe").map((skill) => skill.slug);
  }
  const skills = desiredSlugs.map((slug) => activeBySlug.get(slug)).filter((skill): skill is AgentSkill => Boolean(skill));
  installAgentSkills(skills, dir, opts.force ?? true);
}

export async function runSkillsCommand(opts: {
  server: string;
  token?: string;
  subcommand?: string;
  projectType?: string;
  dir?: string;
  force?: boolean;
}): Promise<void> {
  const subcommand = opts.subcommand ?? "list";
  if (subcommand === "list") {
    const skills = opts.projectType
      ? await listAssignedAgentSkills(opts.server, opts.projectType, opts.token)
      : await listAgentSkills(opts.server, opts.token);
    for (const skill of skills.filter((candidate) => candidate.status !== "disabled")) {
      console.log(`${skill.slug}\t${skill.current_version ?? skill.version ?? "1.0.0"}\t${skill.name}`);
    }
    return;
  }
  if (subcommand === "check") {
    const report = await checkSkillCurrency({ server: opts.server, token: opts.token, projectType: opts.projectType, dir: opts.dir });
    printSkillCurrencyReport(report);
    if (report.drift) process.exit(1);
    return;
  }
  if (subcommand === "sync") {
    await syncAgentSkills({ server: opts.server, token: opts.token, projectType: opts.projectType, dir: opts.dir, force: opts.force ?? true });
    const report = await checkSkillCurrency({ server: opts.server, token: opts.token, projectType: opts.projectType, dir: opts.dir });
    printSkillCurrencyReport(report);
    if (report.drift) process.exit(1);
    return;
  }
  throw new Error("Usage: specreg skills list|check|sync");
}

function installedSkillFileHash(dir: string, slug: string): string | undefined {
  const file = path.resolve(process.cwd(), dir, slug, "SKILL.md");
  if (!fs.existsSync(file)) return undefined;
  return sha256(fs.readFileSync(file, "utf8"));
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function yamlString(value: string): string {
  return JSON.stringify(value.replace(/\s+/g, " ").trim());
}
