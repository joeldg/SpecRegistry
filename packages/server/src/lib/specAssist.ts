import type { Spec } from "@specregistry/shared";
import type { Db } from "../db.js";
import { runLlmText } from "./llm.js";
import { sanitizeDraftFixOutput } from "./aifix.js";

export type SpecAssistMode = "example" | "rewrite";

interface SpecAssistTarget {
  id?: string;
  projectTypeId: string;
  projectId?: string | null;
  filename: string;
  content: string;
}

const SYSTEM = `You are a senior SpecRegistry specification editor.

Produce one complete Markdown specification document that follows SpecRegistry's governed style.

Rules:
- Output ONLY the full markdown document. No preamble, commentary, code fences, or analysis.
- The first non-whitespace character must be "#".
- Use a clear H1 title and these core sections unless the current spec already has a stricter compatible structure: Scope, Intent, Requirements, Non-Goals, Acceptance Evidence, Token Budget Class, Related Specs, AI Agent Directives.
- Requirements must be specific, testable, and traceable.
- Acceptance Evidence must say how a reviewer or agent proves conformance.
- AI Agent Directives must be concise operational guidance, not implementation code.
- Keep terminology, tone, and governance boundaries consistent with the related specs provided.
- Do not invent secrets, credentials, product claims, or implementation facts not present in the guidance/current spec/context.`;

function summarizeRelatedSpecs(db: Db, target: SpecAssistTarget): string {
  const rows = db
    .prepare(
      `SELECT filename, content
       FROM specs
       WHERE deleted_at IS NULL
         AND status != 'draft'
         AND (? IS NULL OR id != ?)
         AND project_id IS ?
         AND project_type_id = ?
       ORDER BY filename
       LIMIT 8`
    )
    .all(target.id ?? null, target.id ?? null, target.projectId ?? null, target.projectTypeId) as Array<{ filename: string; content: string }>;
  const fallback = rows.length
    ? rows
    : (db
        .prepare(
          `SELECT filename, content
           FROM specs
           WHERE deleted_at IS NULL
             AND status != 'draft'
             AND (? IS NULL OR id != ?)
             AND project_id IS NULL
           ORDER BY project_type_id = ? DESC, filename
           LIMIT 8`
        )
        .all(target.id ?? null, target.id ?? null, target.projectTypeId) as Array<{ filename: string; content: string }>);

  return fallback
    .map((row) => {
      const headings = [...row.content.matchAll(/^#{1,3}\s+(.+)$/gm)].map((match) => match[1].trim()).slice(0, 12);
      return `- ${row.filename}: ${headings.join(" | ")}`;
    })
    .join("\n");
}

export async function assistSpec(
  db: Db,
  input: { spec: Spec; mode: SpecAssistMode; guidance: string; currentContent?: string }
): Promise<{ content: string; model: string; provider: string }> {
  return assistSpecTarget(db, {
    target: {
      id: input.spec.id,
      projectTypeId: input.spec.project_type_id,
      projectId: input.spec.project_id,
      filename: input.spec.filename,
      content: input.spec.content,
    },
    mode: input.mode,
    guidance: input.guidance,
    currentContent: input.currentContent,
  });
}

export async function assistNewSpecDraft(
  db: Db,
  input: { projectTypeId: string; projectId?: string | null; filename: string; mode?: SpecAssistMode; guidance: string; currentContent?: string }
): Promise<{ content: string; model: string; provider: string }> {
  return assistSpecTarget(db, {
    target: {
      projectTypeId: input.projectTypeId,
      projectId: input.projectId ?? null,
      filename: input.filename,
      content: input.currentContent?.trim() || `# ${input.filename.replace(/\.md$/i, "")}\n\n_Draft._\n`,
    },
    mode: input.mode ?? "example",
    guidance: input.guidance,
    currentContent: input.currentContent,
  });
}

async function assistSpecTarget(
  db: Db,
  input: { target: SpecAssistTarget; mode: SpecAssistMode; guidance: string; currentContent?: string }
): Promise<{ content: string; model: string; provider: string }> {
  const current = input.currentContent?.trim() || input.target.content;
  const related = summarizeRelatedSpecs(db, input.target);
  const user = `## Task
${input.mode === "rewrite" ? "Rewrite the current specification using the guidance." : "Generate a complete example specification using the guidance and the current specification as style/context."}

## Target file
${input.target.filename}

## Mode
${input.mode}

## User guidance
${input.guidance}

## Current specification
<current-spec>
${current}
</current-spec>

## Related specification headings
${related || "- No related published specs found."}

## Output contract
Return the complete revised/example markdown specification only.`;

  const result = await runLlmText(db, {
    system: SYSTEM,
    user,
    maxTokens: 16000,
    route: "spec_generation",
  });
  return {
    content: sanitizeDraftFixOutput(result.text, current),
    model: result.model,
    provider: result.provider,
  };
}
