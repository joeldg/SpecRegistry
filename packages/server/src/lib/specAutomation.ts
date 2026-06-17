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
