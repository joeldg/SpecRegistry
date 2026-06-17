export interface SpecPurposeTemplate {
  id: string;
  filename: string;
  title: string;
  description: string;
  required_sections: string[];
  prompt: string;
  content_template: string;
  signals: string[];
}

export interface SpecGap {
  purpose_id: string;
  filename: string;
  title: string;
  reason: string;
  confidence: number;
  evidence: string[];
}

export interface AutomationSpecInput {
  id: string;
  filename: string;
  content: string;
  current_version: string;
  project_type_name?: string;
}

export interface ClassifiedSection {
  spec_id: string;
  filename: string;
  section: string;
  classification: "invariant" | "acceptance_criteria" | "example" | "non_goal" | "operational" | "security" | "reference" | "directive";
  reason: string;
  approx_tokens: number;
}

export interface TaskPlan {
  task: string;
  applicable_specs: Array<{ spec_id: string; filename: string; reason: string; priority: number }>;
  sections: ClassifiedSection[];
  missing_specs: SpecGap[];
  acceptance_criteria: string[];
}

export interface ContextSelection {
  token_budget: number;
  estimated_tokens: number;
  selected_sections: ClassifiedSection[];
  omitted_sections: ClassifiedSection[];
}

export const PURPOSE_TEMPLATES: SpecPurposeTemplate[] = [
  {
    id: "api-contract",
    filename: "API.md",
    title: "API Contract",
    description: "HTTP, RPC, GraphQL, or public service contract.",
    required_sections: ["Purpose", "Endpoints", "Authentication", "Error Handling", "Compatibility", "AI Agent Directives"],
    signals: ["routes", "controllers", "openapi", "swagger", "api/", "graphql", "rpc"],
    prompt: "Generate an API contract specification from the repository evidence. Include endpoints, auth, error handling, compatibility, examples, non-goals, observability, and AI agent directives.",
    content_template: `# API Contract

## Purpose

Describe the API surface and the implementation intent it protects.

## Endpoints

| Method | Path | Purpose | Request | Response |
| --- | --- | --- | --- | --- |

## Authentication

Define auth requirements and forbidden shortcuts.

## Error Handling

Define status/error semantics and retry behavior.

## Compatibility

Classify breaking and non-breaking changes.

## Non-Goals

State what this spec does not govern.

## Observability

Define required logs, metrics, traces, and audit events.

## AI Agent Directives

State what an agent must inspect before changing the API.
`,
  },
  {
    id: "database-schema",
    filename: "DATABASE_SCHEMA.md",
    title: "Database Schema",
    description: "Data model, migrations, indexes, and rollback constraints.",
    required_sections: ["Purpose", "Entities", "Migrations", "Indexes", "Rollback", "AI Agent Directives"],
    signals: ["migrations", "schema", "prisma", "typeorm", "sequelize", "models", ".sql"],
    prompt: "Generate a database schema specification. Include entities, migration rules, indexes, destructive-change policy, rollback, examples, observability, and AI agent directives.",
    content_template: `# Database Schema

## Purpose

Describe the data model and operational risk this spec protects.

## Entities

| Entity | Purpose | Owner | Persistence Notes |
| --- | --- | --- | --- |

## Migrations

Define migration review, compatibility, and data backfill requirements.

## Indexes

Document expected query patterns and index requirements.

## Rollback

Define rollback and destructive-change constraints.

## Non-Goals

State what this spec does not govern.

## Observability

Define required database metrics and alerts.

## AI Agent Directives

State what an agent must validate before changing persistence behavior.
`,
  },
  {
    id: "test-strategy",
    filename: "TEST_STRATEGY.md",
    title: "Test Strategy",
    description: "Required test levels, evidence, fixtures, and CI gates.",
    required_sections: ["Purpose", "Test Levels", "Required Evidence", "CI Gates", "AI Agent Directives"],
    signals: ["test", "tests", "spec", "vitest", "jest", "pytest", "playwright", "cypress", "ci"],
    prompt: "Generate a test strategy specification. Include test levels, evidence requirements, CI gates, fixtures, non-goals, operational risk, and AI agent directives.",
    content_template: `# Test Strategy

## Purpose

Describe the quality outcome this spec protects.

## Test Levels

| Level | Required For | Evidence |
| --- | --- | --- |

## Required Evidence

Define what proof must accompany a change.

## CI Gates

Define required automated checks.

## Non-Goals

State what this spec does not govern.

## Observability

Define test reporting and flaky-test handling.

## AI Agent Directives

State what tests an agent must run or update.
`,
  },
  {
    id: "observability",
    filename: "OBSERVABILITY.md",
    title: "Observability",
    description: "Logs, metrics, traces, audit events, and operational diagnostics.",
    required_sections: ["Purpose", "Signals", "Dashboards", "Alerts", "AI Agent Directives"],
    signals: ["metrics", "prometheus", "grafana", "opentelemetry", "logger", "logging", "trace", "audit"],
    prompt: "Generate an observability specification. Include required signals, dashboards, alerts, examples, non-goals, failure modes, and AI agent directives.",
    content_template: `# Observability

## Purpose

Describe the operational questions this spec must answer.

## Signals

| Signal | Type | Owner | Required Labels |
| --- | --- | --- | --- |

## Dashboards

Define expected dashboards and review cadence.

## Alerts

Define paging and ticket alerts.

## Non-Goals

State what this spec does not govern.

## Failure Modes

Define what must be observable during incidents.

## AI Agent Directives

State what telemetry an agent must add or preserve.
`,
  },
  {
    id: "security-privacy",
    filename: "SECURITY_PRIVACY.md",
    title: "Security and Privacy",
    description: "Auth, secrets, privacy, authorization, and sensitive data rules.",
    required_sections: ["Purpose", "Authentication", "Authorization", "Secrets", "Privacy", "AI Agent Directives"],
    signals: ["auth", "token", "secret", "password", "oauth", "jwt", "permission", "role", "pii", "privacy"],
    prompt: "Generate a security and privacy specification. Include authentication, authorization, secrets, PII, threat boundaries, examples, non-goals, observability, and AI agent directives.",
    content_template: `# Security and Privacy

## Purpose

Describe the security and privacy outcomes this spec protects.

## Authentication

Define identity and session requirements.

## Authorization

Define permission and role requirements.

## Secrets

Define how secrets are stored, rotated, and excluded from logs.

## Privacy

Define sensitive data handling and retention constraints.

## Non-Goals

State what this spec does not govern.

## Observability

Define audit logs and security telemetry.

## AI Agent Directives

State what an agent must refuse, validate, or escalate.
`,
  },
  {
    id: "agent-operating-rules",
    filename: "AI_AGENT_OPERATING_RULES.md",
    title: "AI Agent Operating Rules",
    description: "Rules of engagement for autonomous or assisted implementation agents.",
    required_sections: ["Purpose", "Rules", "Stop Conditions", "Required Evidence", "AI Agent Directives"],
    signals: ["agents.md", "claude.md", "cursor", "mcp", "ai", "agent"],
    prompt: "Generate AI agent operating rules. Include specification-first behavior, stop conditions, required evidence, approval gates, non-goals, and AI agent directives.",
    content_template: `# AI Agent Operating Rules

## Purpose

Define the conditions under which an AI agent may act.

## Rules

1. Agents must load governed specs before implementation.
2. Agents must report ambiguity instead of guessing.

## Stop Conditions

Define when an agent must halt and escalate.

## Required Evidence

Define required summaries, tests, citations, and artifacts.

## Non-Goals

State what this spec does not govern.

## Observability

Define required telemetry for agent actions.

## AI Agent Directives

Restate the executable rules an agent must follow.
`,
  },
  {
    id: "deployment-runbook",
    filename: "DEPLOYMENT_RUNBOOK.md",
    title: "Deployment Runbook",
    description: "Release, rollback, environment, and incident constraints.",
    required_sections: ["Purpose", "Environments", "Release Process", "Rollback", "AI Agent Directives"],
    signals: ["docker", "kubernetes", "helm", "terraform", "deploy", "release", "rollback", "runbook"],
    prompt: "Generate a deployment/runbook specification. Include environments, release process, rollback, failure modes, examples, non-goals, observability, and AI agent directives.",
    content_template: `# Deployment Runbook

## Purpose

Describe the release and operational outcome this spec protects.

## Environments

Define environments and configuration boundaries.

## Release Process

Define deployment steps and approvals.

## Rollback

Define rollback criteria and commands.

## Non-Goals

State what this spec does not govern.

## Observability

Define deployment metrics, logs, and checks.

## AI Agent Directives

State what an agent must verify before changing deployment behavior.
`,
  },
];

function normalizedTree(input: string): string {
  return input.toLowerCase();
}

function evidenceFor(tree: string, template: SpecPurposeTemplate): string[] {
  const lower = normalizedTree(tree);
  return template.signals.filter((signal) => lower.includes(signal.toLowerCase())).slice(0, 8);
}

export function detectSpecGaps(input: {
  tree: string;
  existingSpecs?: string[];
  detectedLanguages?: string[];
}): SpecGap[] {
  const existing = new Set((input.existingSpecs ?? []).map((name) => name.toLowerCase()));
  const gaps: SpecGap[] = [];
  for (const template of PURPOSE_TEMPLATES) {
    if (existing.has(template.filename.toLowerCase())) continue;
    const evidence = evidenceFor(input.tree, template);
    if (evidence.length === 0) continue;
    const confidence = Math.min(0.95, 0.45 + evidence.length * 0.1);
    gaps.push({
      purpose_id: template.id,
      filename: template.filename,
      title: template.title,
      reason: `Repository evidence suggests a ${template.title.toLowerCase()} spec is needed.`,
      confidence: Math.round(confidence * 100) / 100,
      evidence,
    });
  }
  return gaps.sort((a, b) => b.confidence - a.confidence || a.filename.localeCompare(b.filename));
}

export function purposePrompt(input: {
  purpose: SpecPurposeTemplate;
  projectType: string;
  tree: string;
  detectedLanguages?: string[];
  extraContext?: string;
}): string {
  const languages = input.detectedLanguages?.length ? input.detectedLanguages.join(", ") : "unknown";
  return `${input.purpose.prompt}

Project type: ${input.projectType}
Detected languages: ${languages}

Repository evidence:
\`\`\`
${input.tree || "(no tree provided)"}
\`\`\`

${input.extraContext ? `Additional context:\n${input.extraContext}\n\n` : ""}Use this required section set: ${input.purpose.required_sections.join(", ")}.
Output strict Markdown only.`;
}

export function deterministicSpecDraft(input: {
  purpose: SpecPurposeTemplate;
  projectType: string;
  tree: string;
  detectedLanguages?: string[];
}): string {
  const languages = input.detectedLanguages?.length ? input.detectedLanguages.join(", ") : "unknown";
  return `${input.purpose.content_template}
## Repository Evidence

- Project type: ${input.projectType}
- Detected languages: ${languages}

\`\`\`
${input.tree.slice(0, 4000) || "(no tree provided)"}
\`\`\`
`;
}

function approxTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

function keywordScore(text: string, query: string): number {
  const words = query
    .toLowerCase()
    .split(/[^a-z0-9_]+/)
    .filter((word) => word.length > 2);
  const lower = text.toLowerCase();
  return words.reduce((score, word) => score + (lower.includes(word) ? 1 : 0), 0);
}

function splitMarkdownSections(content: string): Array<{ section: string; text: string }> {
  const sections: Array<{ section: string; text: string }> = [];
  let current = { section: "(intro)", text: "" };
  for (const line of content.split("\n")) {
    const match = /^#{1,3}\s+(.+?)\s*$/.exec(line);
    if (match) {
      if (current.text.trim()) sections.push({ ...current, text: current.text.trim() });
      current = { section: match[1], text: "" };
    } else {
      current.text += `${line}\n`;
    }
  }
  if (current.text.trim()) sections.push({ ...current, text: current.text.trim() });
  return sections;
}

export function classifySpecSections(specs: AutomationSpecInput[]): ClassifiedSection[] {
  const rows: ClassifiedSection[] = [];
  for (const spec of specs) {
    for (const section of splitMarkdownSections(spec.content)) {
      const haystack = `${spec.filename} ${section.section} ${section.text}`.toLowerCase();
      const classification: ClassifiedSection["classification"] =
        /ai agent directives?|agent directives?|operating rules/.test(haystack)
          ? "directive"
          : /non[- ]?goals?|out of scope/.test(haystack)
            ? "non_goal"
            : /acceptance|criteria|must pass|required evidence|ci gates/.test(haystack)
              ? "acceptance_criteria"
              : /security|auth|secret|token|privacy|permission|role/.test(haystack)
                ? "security"
                : /observability|metrics|logs|traces|alerts|rollback|failure|deployment/.test(haystack)
                  ? "operational"
                  : /example|sample|for instance/.test(haystack)
                    ? "example"
                    : /reference|schema|map|table|contract|endpoint|resource/.test(haystack)
                      ? "reference"
                      : "invariant";
      rows.push({
        spec_id: spec.id,
        filename: spec.filename,
        section: section.section,
        classification,
        reason: `Matched ${classification.replace("_", " ")} signals in section content.`,
        approx_tokens: approxTokens(`${section.section}\n${section.text}`),
      });
    }
  }
  return rows;
}

export function planTaskContext(input: {
  task: string;
  tree: string;
  specs: AutomationSpecInput[];
  existingSpecs?: string[];
  tokenBudget?: number;
}): TaskPlan & { context_selection: ContextSelection } {
  const classified = classifySpecSections(input.specs);
  const applicable = input.specs
    .map((spec) => {
      const score = keywordScore(`${spec.filename}\n${spec.content}`, input.task);
      return {
        spec_id: spec.id,
        filename: spec.filename,
        reason: score > 0 ? "Task terms match spec content." : "Included as governed context.",
        priority: score,
      };
    })
    .filter((row) => row.priority > 0)
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 8);
  const sections = classified
    .map((section) => ({
      ...section,
      score:
        keywordScore(`${section.filename} ${section.section}`, input.task) +
        (section.classification === "directive" ? 3 : 0) +
        (section.classification === "acceptance_criteria" ? 2 : 0) +
        (section.classification === "security" ? 1 : 0),
    }))
    .sort((a, b) => b.score - a.score || a.approx_tokens - b.approx_tokens);
  const context_selection = optimizeContext({
    sections,
    tokenBudget: input.tokenBudget ?? 2000,
  });
  return {
    task: input.task,
    applicable_specs: applicable,
    sections: sections.slice(0, 12).map(({ score: _score, ...section }) => section),
    missing_specs: detectSpecGaps({ tree: input.tree, existingSpecs: input.existingSpecs }),
    acceptance_criteria: [
      "Implementation cites the governed spec sections it follows.",
      "Tests or evidence cover each affected acceptance/directive section.",
      "Any missing or conflicting spec guidance is filed as feedback before implementation.",
    ],
    context_selection,
  };
}

export function optimizeContext(input: {
  sections: Array<ClassifiedSection & { score?: number }>;
  tokenBudget: number;
}): ContextSelection {
  const selected: ClassifiedSection[] = [];
  const omitted: ClassifiedSection[] = [];
  let used = 0;
  for (const section of input.sections) {
    const clean: ClassifiedSection = {
      spec_id: section.spec_id,
      filename: section.filename,
      section: section.section,
      classification: section.classification,
      reason: section.reason,
      approx_tokens: section.approx_tokens,
    };
    if (used + clean.approx_tokens <= input.tokenBudget) {
      selected.push(clean);
      used += clean.approx_tokens;
    } else {
      omitted.push(clean);
    }
  }
  return { token_budget: input.tokenBudget, estimated_tokens: used, selected_sections: selected, omitted_sections: omitted };
}

export function ticketChecklist(input: { task: string; plan: TaskPlan }): string {
  const specs = input.plan.applicable_specs.map((spec) => `- [ ] Review \`${spec.filename}\` (${spec.reason})`).join("\n");
  const criteria = input.plan.acceptance_criteria.map((criterion) => `- [ ] ${criterion}`).join("\n");
  const missing = input.plan.missing_specs.map((gap) => `- [ ] Resolve spec gap: \`${gap.filename}\` (${gap.reason})`).join("\n");
  return `# Implementation Checklist

## Task

${input.task}

## Governing Specs

${specs || "- [ ] No direct spec match found; run spec gap detection before implementation."}

## Acceptance Criteria

${criteria}

## Missing Spec Work

${missing || "- [x] No missing spec gaps detected from supplied evidence."}

## PR Evidence

- [ ] Summary cites relevant spec sections.
- [ ] Tests or audit evidence are attached.
- [ ] Spec feedback was filed for unclear or conflicting guidance.
`;
}

export function auditPromptForSpec(spec: AutomationSpecInput): string {
  const classified = classifySpecSections([spec]);
  const focus = classified
    .filter((section) => ["directive", "acceptance_criteria", "security", "operational"].includes(section.classification))
    .map((section) => `- ${section.section} (${section.classification})`)
    .join("\n");
  return `Audit an implementation for conformance with ${spec.filename}@${spec.current_version}.

Focus sections:
${focus || "- All normative sections"}

Return JSON findings with: severity, spec_section, file_path, evidence, and recommendation.
Flag literal compliance that misses the stated intent.`;
}

export function improvementSuggestions(input: {
  specs: AutomationSpecInput[];
  feedback?: Array<{ spec_id: string; error_type: string; description: string; status: string }>;
  roi?: Array<{ spec_id: string; roi_score: number; open_feedback: number }>;
}): Array<{ spec_id: string; filename: string; suggestion: string; reason: string; priority: number }> {
  const suggestions = [];
  for (const spec of input.specs) {
    const classified = classifySpecSections([spec]);
    const feedback = (input.feedback ?? []).filter((item) => item.spec_id === spec.id && item.status !== "resolved");
    const roi = (input.roi ?? []).find((item) => item.spec_id === spec.id);
    if (!classified.some((section) => section.classification === "non_goal")) {
      suggestions.push({ spec_id: spec.id, filename: spec.filename, suggestion: "Add explicit non-goals.", reason: "Agents need boundaries to avoid over-implementation.", priority: 2 });
    }
    if (!classified.some((section) => section.classification === "example")) {
      suggestions.push({ spec_id: spec.id, filename: spec.filename, suggestion: "Add good and bad examples.", reason: "Examples improve LLM interpretation and review consistency.", priority: 2 });
    }
    if (feedback.length > 0) {
      suggestions.push({ spec_id: spec.id, filename: spec.filename, suggestion: "Clarify sections tied to open feedback.", reason: `${feedback.length} unresolved feedback item(s).`, priority: 3 });
    }
    if (roi && roi.roi_score < 1) {
      suggestions.push({ spec_id: spec.id, filename: spec.filename, suggestion: "Shorten or split low-ROI content.", reason: "Token cost appears high relative to measured lift and usage.", priority: 1 });
    }
  }
  return suggestions.sort((a, b) => b.priority - a.priority || a.filename.localeCompare(b.filename));
}

export function composeSpecPack(input: {
  name: string;
  purposes: SpecPurposeTemplate[];
}): { name: string; specs: Array<{ filename: string; content: string; purpose_id: string }> } {
  return {
    name: input.name,
    specs: input.purposes.map((purpose) => ({
      filename: purpose.filename,
      purpose_id: purpose.id,
      content: purpose.content_template,
    })),
  };
}
