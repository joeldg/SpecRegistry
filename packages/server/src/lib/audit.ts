import Anthropic from "@anthropic-ai/sdk";
import type { ProjectType } from "@specregistry/shared";
import type { Db } from "../db.js";
import { HttpError } from "../helpers.js";
import { bundleSpecs } from "./compile.js";

const MODEL = "claude-opus-4-8";

export interface AuditFinding {
  severity: "high" | "medium" | "low";
  spec: string;
  section: string;
  file: string;
  description: string;
  recommendation: string;
}

export interface AuditInput {
  tree: string;
  files: Array<{ path: string; content: string }>;
}

function requireApiKey(): void {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new HttpError(503, "This feature requires ANTHROPIC_API_KEY to be configured on the server");
  }
}

/** Pull a JSON object out of a model response, tolerating code fences and prose. */
export function extractJson<T>(text: string): T {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) throw new HttpError(502, "Model response contained no JSON object");
  return JSON.parse(candidate.slice(start, end + 1)) as T;
}

async function runClaude(system: string, user: string, maxTokens = 16000): Promise<string> {
  const client = new Anthropic();
  const stream = client.messages.stream({
    model: MODEL,
    max_tokens: maxTokens,
    thinking: { type: "adaptive" },
    system,
    messages: [{ role: "user", content: user }],
  });
  const message = await stream.finalMessage();
  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

/** Reverse conformance: does this codebase follow its governed specs? */
export async function auditCodebase(db: Db, pt: ProjectType, input: AuditInput): Promise<AuditFinding[]> {
  requireApiKey();
  const specs = bundleSpecs(db, pt.id);
  const specBlock = specs
    .map((s) => `<spec filename="${s.filename}" version="${s.current_version}">\n${s.content}\n</spec>`)
    .join("\n\n");
  const fileBlock = input.files
    .map((f) => `<file path="${f.path}">\n${f.content}\n</file>`)
    .join("\n\n");

  const system = `You are a conformance auditor for SpecRegistry. You receive an organization's governed
specification documents and a snapshot of a codebase (directory tree plus selected files). Report every
place the codebase violates, contradicts, or ignores a requirement stated in the specifications.

Rules:
- Only report violations of requirements that are explicitly stated in the provided specs.
- Cite the spec filename and the section heading the requirement comes from.
- Cite the file (or "(repo-wide)") where the violation occurs.
- severity: "high" for security or correctness violations, "medium" for structural/process violations, "low" for style.
- If the provided snapshot is insufficient to evaluate a requirement, do not guess — omit it.
- Output ONLY a JSON object: {"findings": [{"severity", "spec", "section", "file", "description", "recommendation"}]}.
- An empty findings array is a valid and common result.`;

  const user = `## Governed specifications (project type: ${pt.name})

${specBlock}

## Codebase snapshot

### Directory tree
\`\`\`
${input.tree}
\`\`\`

### Selected files
${fileBlock}`;

  const raw = await runClaude(system, user);
  const parsed = extractJson<{ findings?: AuditFinding[] }>(raw);
  return Array.isArray(parsed.findings) ? parsed.findings : [];
}

export interface EfficacyResult {
  score_with: number;
  score_without: number;
  improved: boolean;
  rationale: string;
  model: string;
}

/**
 * Spec efficacy A/B: generate a response to the task with and without the spec in
 * context, then grade both against the spec's requirements. Measures whether the
 * spec actually changes agent output.
 */
export async function runEfficacy(specContent: string, specFilename: string, task: string): Promise<EfficacyResult> {
  requireApiKey();
  const baseSystem = "You are an engineer completing the task you are given. Be concrete and produce real output (code, config, or a plan as appropriate). Keep it under 600 words.";
  const [withSpec, withoutSpec] = await Promise.all([
    runClaude(
      `${baseSystem}\n\nYou MUST follow this governing specification (${specFilename}):\n\n${specContent}`,
      task,
      4000
    ),
    runClaude(baseSystem, task, 4000),
  ]);

  const judgeSystem = `You are grading how well two anonymous responses to the same task adhere to a governing
specification. Score each 0-100 for adherence to the specification's explicit requirements (not general quality).
Output ONLY JSON: {"score_a": n, "score_b": n, "rationale": "one short paragraph comparing them against specific spec requirements"}.`;
  const judgeUser = `## Specification (${specFilename})
${specContent}

## Task
${task}

## Response A
${withSpec}

## Response B
${withoutSpec}`;

  const verdict = extractJson<{ score_a: number; score_b: number; rationale: string }>(
    await runClaude(judgeSystem, judgeUser, 4000)
  );
  return {
    score_with: verdict.score_a,
    score_without: verdict.score_b,
    improved: verdict.score_a > verdict.score_b,
    rationale: verdict.rationale,
    model: MODEL,
  };
}
