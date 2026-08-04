#!/usr/bin/env node
/**
 * Load the General-Purpose Specification Library into a running SpecRegistry instance.
 *
 * Populates seven project types, each corresponding to a domain of general engineering
 * governance. All specs are written to be customized — they ship with placeholder values
 * that teams replace with their own specifics.
 *
 * Project types created:
 *   - Engineering Process   (branching, reviews, releases, incidents, runbooks, change mgmt)
 *   - Architecture          (ADRs, API contracts, events, data models, boundaries, dependencies)
 *   - Security              (auth, authz, data classification, privacy, vulnerabilities, secrets)
 *   - Testing               (test strategy, acceptance criteria, load/perf, chaos/resilience)
 *   - Observability         (logging, metrics, tracing, SLOs, deployment runbooks)
 *   - AI Governance         (LLM policy, prompt governance, data handling, agent containment)
 *   - Team                  (onboarding, decision log, meeting cadence, escalation path)
 *
 * Idempotent: existing project types and specs are detected and skipped.
 *
 * Usage:
 *   node samples/general/load.mjs
 *   SPECREG_SERVER=http://localhost:4000 node samples/general/load.mjs
 *   SPECREG_TOKEN=sreg_... node samples/general/load.mjs    # auth-required servers
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SERVER = process.env.SPECREG_SERVER ?? "http://localhost:4000";
const TOKEN = process.env.SPECREG_TOKEN;
const AUTHOR = process.env.SPECREG_AUTHOR ?? "general-sample";
const here = path.dirname(fileURLToPath(import.meta.url));

const PROJECT_TYPES = [
  {
    name: "Engineering Process",
    industry: "General / Software Engineering",
    description:
      "Branching strategy, code review, release process, incident response, on-call runbooks, and change management. Foundational process governance for any software team.",
    dir: "engineering-process",
  },
  {
    name: "Architecture",
    industry: "General / Software Engineering",
    description:
      "Architecture Decision Records, REST API contracts, event schema, data modeling, service boundaries, and dependency policy. Structural governance for any software system.",
    dir: "architecture",
  },
  {
    name: "Security",
    industry: "General / Security",
    description:
      "Authentication flows, authorization model, data classification, privacy and PII, vulnerability management, and secrets management. Security baseline for any production system.",
    dir: "security",
  },
  {
    name: "Testing",
    industry: "General / Quality",
    description:
      "Test strategy, acceptance criteria standard, load and performance, and chaos and resilience engineering. Quality governance for any software team.",
    dir: "testing",
  },
  {
    name: "Observability",
    industry: "General / Operations",
    description:
      "Logging standard, metrics and alerting, distributed tracing, SLO policy, and deployment runbooks. Operational governance for any production service.",
    dir: "observability",
  },
  {
    name: "AI Governance",
    industry: "General / AI",
    description:
      "LLM usage policy, prompt governance, AI data handling, and agent containment. Governance for teams using AI assistants and autonomous agents.",
    dir: "ai-governance",
  },
  {
    name: "Team",
    industry: "General / Management",
    description:
      "Onboarding checklist, decision log, meeting cadence, and escalation path. Team process governance for engineering organizations.",
    dir: "team",
  },
];

async function api(method, route, body) {
  const res = await fetch(`${SERVER}${route}`, {
    method,
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      ...(TOKEN ? { authorization: `Bearer ${TOKEN}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const j = await res.json();
      detail = j.message ?? j.error ?? detail;
    } catch {
      /* non-JSON body */
    }
    const err = new Error(`${method} ${route} → ${res.status} ${detail}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

function readSpecs(dir) {
  const full = path.join(here, dir);
  return fs
    .readdirSync(full)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .map((filename) => ({
      filename,
      content: fs.readFileSync(path.join(full, filename), "utf8"),
    }));
}

async function ensureProjectType(name, meta) {
  const types = await api("GET", "/api/v1/project-types");
  const existing = types.find((t) => t.name.toLowerCase() === name.toLowerCase());
  if (existing) return existing;
  console.log(`  Creating project type "${name}"...`);
  return api("POST", "/api/v1/project-types", {
    name,
    industry: meta.industry,
    description: meta.description,
  });
}

async function loadSpecsInto(projectType, specs) {
  const summaries = await api("GET", `/api/v1/specs?project_type_id=${projectType.id}`);
  const present = new Set(summaries.map((s) => s.filename.toLowerCase()));
  let created = 0;
  for (const spec of specs) {
    if (present.has(spec.filename.toLowerCase())) {
      console.log(`    = ${spec.filename} (already present, skipped)`);
      continue;
    }
    const draft = await api("POST", "/api/v1/specs", {
      project_type_id: projectType.id,
      filename: spec.filename,
      content: spec.content,
      updated_by: AUTHOR,
    });
    await api("POST", `/api/v1/specs/${draft.id}/publish`, { published_by: AUTHOR });
    console.log(`    + ${spec.filename} (published 1.0.0)`);
    created++;
  }
  return created;
}

async function main() {
  console.log(`Loading General-Purpose Specification Library into ${SERVER}\n`);

  let totalCreated = 0;

  for (const pt of PROJECT_TYPES) {
    const projectType = await ensureProjectType(pt.name, pt);
    console.log(`\n${pt.name} → "${projectType.name}" (id: ${projectType.id}):`);
    const specs = readSpecs(pt.dir);
    const created = await loadSpecsInto(projectType, specs);
    totalCreated += created;
  }

  console.log(
    `\nDone. Published ${totalCreated} spec(s) across ${PROJECT_TYPES.length} project types.` +
      (totalCreated === 0 ? " (Everything was already loaded.)" : "")
  );
  console.log(
    "\nThese specs contain placeholder values (marked with <!-- ... -->) intended to be\n" +
      "replaced with your team's specific tools, thresholds, contacts, and decisions."
  );
}

main().catch((err) => {
  if (err.status === 401) {
    console.error(
      `\nAuth required. Set SPECREG_TOKEN (POST /api/v1/auth/login to obtain one):\n  ${err.message}`
    );
  } else {
    console.error(`\nFailed: ${err.message}`);
  }
  process.exit(1);
});
