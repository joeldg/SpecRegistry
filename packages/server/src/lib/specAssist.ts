import type { Spec } from "@specregistry/shared";
import type { Db } from "../db.js";
import { runLlmText } from "./llm.js";
import { sanitizeDraftFixOutput } from "./aifix.js";

export type SpecAssistMode = "example" | "rewrite";

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

function summarizeRelatedSpecs(db: Db, spec: Spec): string {
  const rows = db
    .prepare(
      `SELECT filename, content
       FROM specs
       WHERE deleted_at IS NULL
         AND status != 'draft'
         AND id != ?
         AND project_id IS ?
         AND project_type_id = ?
       ORDER BY filename
       LIMIT 8`
    )
    .all(spec.id, spec.project_id ?? null, spec.project_type_id) as Array<{ filename: string; content: string }>;
  const fallback = rows.length
    ? rows
    : (db
        .prepare(
          `SELECT filename, content
           FROM specs
           WHERE deleted_at IS NULL
             AND status != 'draft'
             AND id != ?
             AND project_id IS NULL
           ORDER BY project_type_id = ? DESC, filename
           LIMIT 8`
        )
        .all(spec.id, spec.project_type_id) as Array<{ filename: string; content: string }>);

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
  const current = input.currentContent?.trim() || input.spec.content;
  const related = summarizeRelatedSpecs(db, input.spec);
  const user = `## Task
${input.mode === "rewrite" ? "Rewrite the current specification using the guidance." : "Generate a complete example specification using the guidance and the current specification as style/context."}

## Target file
${input.spec.filename}

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
