import type { Db } from "../db.js";

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

export function assignedSkills(
  db: Db,
  projectTypeId?: string | null,
  projectId?: string | null
): AgentSkillRecord[] {
  const rows = db.prepare(
    `SELECT ask.*
     FROM skill_assignments sa
     JOIN agent_skills ask ON ask.id = sa.skill_id
     WHERE ask.status = 'active'
       AND (
         sa.scope = 'global'
         OR (sa.scope = 'project_type' AND sa.project_type_id = ?)
         OR (sa.scope = 'project' AND sa.project_id = ?)
       )
     GROUP BY ask.id
     ORDER BY ask.name`
  ).all(projectTypeId ?? null, projectId ?? null) as AgentSkillRecord[];
  return rows;
}
