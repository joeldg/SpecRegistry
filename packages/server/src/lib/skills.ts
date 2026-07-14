import { createHash } from "node:crypto";
import type { Db } from "../db.js";

export type SkillAssignmentScope = "global" | "project_type" | "project";

export interface AgentSkillRecord {
  id: string;
  slug: string;
  name: string;
  description: string;
  instructions: string;
  risk_level: "safe" | "restricted";
  status: "active" | "disabled";
  built_in: number;
  source_candidate_id?: string | null;
  source_url?: string | null;
  source_path?: string | null;
  source_commit?: string | null;
  imported_at?: string | null;
  transformed_by?: string | null;
  upstream_content_hash?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AssignedAgentSkillRecord extends AgentSkillRecord {
  assignment_scopes: SkillAssignmentScope[];
}

export interface AgentSkillManifestEntry {
  id: string;
  slug: string;
  name: string;
  description: string;
  risk_level: AgentSkillRecord["risk_level"];
  status: AgentSkillRecord["status"];
  built_in: boolean;
  assignment_scopes: SkillAssignmentScope[];
  content_hash: string;
  source: {
    candidate_id: string | null;
    url: string | null;
    path: string | null;
    commit: string | null;
    imported_at: string | null;
    transformed_by: string | null;
    upstream_content_hash: string | null;
  };
  updated_at: string;
}

export function renderSkillMarkdown(skill: AgentSkillRecord): string {
  return `---
name: ${skill.slug}
description: ${JSON.stringify(skill.description.replace(/\s+/g, " ").trim())}
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

export function skillContentHash(skill: AgentSkillRecord): string {
  return createHash("sha256").update(renderSkillMarkdown(skill)).digest("hex");
}

export function skillManifestEntry(skill: AssignedAgentSkillRecord): AgentSkillManifestEntry {
  return {
    id: skill.id,
    slug: skill.slug,
    name: skill.name,
    description: skill.description,
    risk_level: skill.risk_level,
    status: skill.status,
    built_in: Boolean(skill.built_in),
    assignment_scopes: skill.assignment_scopes,
    content_hash: skillContentHash(skill),
    source: {
      candidate_id: skill.source_candidate_id ?? null,
      url: skill.source_url ?? null,
      path: skill.source_path ?? null,
      commit: skill.source_commit ?? null,
      imported_at: skill.imported_at ?? null,
      transformed_by: skill.transformed_by ?? null,
      upstream_content_hash: skill.upstream_content_hash ?? null,
    },
    updated_at: skill.updated_at,
  };
}

export function assignedSkills(
  db: Db,
  projectTypeId?: string | null,
  projectId?: string | null
): AssignedAgentSkillRecord[] {
  const rows = db.prepare(
    `SELECT ask.*, sa.scope AS assignment_scope
     FROM skill_assignments sa
     JOIN agent_skills ask ON ask.id = sa.skill_id
     WHERE ask.status = 'active'
       AND (
         sa.scope = 'global'
         OR (sa.scope = 'project_type' AND sa.project_type_id = ?)
         OR (sa.scope = 'project' AND sa.project_id = ?)
       )
     ORDER BY ask.name, sa.scope`
  ).all(projectTypeId ?? null, projectId ?? null) as Array<AgentSkillRecord & { assignment_scope: SkillAssignmentScope }>;
  const merged = new Map<string, AssignedAgentSkillRecord>();
  for (const row of rows) {
    const existing = merged.get(row.id);
    if (existing) {
      if (!existing.assignment_scopes.includes(row.assignment_scope)) existing.assignment_scopes.push(row.assignment_scope);
      continue;
    }
    const { assignment_scope: assignmentScope, ...skill } = row;
    merged.set(skill.id, { ...skill, assignment_scopes: [assignmentScope] });
  }
  return [...merged.values()];
}
