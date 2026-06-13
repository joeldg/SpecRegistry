#!/usr/bin/env node
/**
 * Load the AI-SDD sample spec pack into a running SpecRegistry instance via its API.
 *
 * Populates:
 *   - the existing "Global" project type with org-wide process specifications
 *   - a new "Embedded Systems Platform" project type with technical contract specifications
 *
 * Idempotent: existing project types and specs are detected and skipped, so it is safe
 * to re-run. Each spec is created as a draft and then published (1.0.0).
 *
 * Usage:
 *   node samples/ai-sdd/load.mjs
 *   SPECREG_SERVER=http://localhost:4000 node samples/ai-sdd/load.mjs
 *   SPECREG_TOKEN=sreg_...  node samples/ai-sdd/load.mjs   # when the server requires auth
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SERVER = process.env.SPECREG_SERVER ?? "http://localhost:4000";
const TOKEN = process.env.SPECREG_TOKEN;
const AUTHOR = process.env.SPECREG_AUTHOR ?? "ai-sdd-sample";
const here = path.dirname(fileURLToPath(import.meta.url));

const PROJECT_TYPE = {
  name: "Embedded Systems Platform",
  industry: "Embedded / Hardware",
  description:
    "Firmware and protocol-bound systems: APIs, SNMP, UDP, protobuf, configuration, data model, and hardware-in-the-loop testing.",
  dir: "embedded-systems-platform",
};

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
    .map((filename) => ({ filename, content: fs.readFileSync(path.join(full, filename), "utf8") }));
}

async function ensureProjectType(name, meta) {
  const types = await api("GET", "/api/v1/project-types");
  const existing = types.find((t) => t.name.toLowerCase() === name.toLowerCase());
  if (existing) return existing;
  console.log(`Creating project type "${name}"...`);
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
      console.log(`  = ${spec.filename} (already present, skipped)`);
      continue;
    }
    const draft = await api("POST", "/api/v1/specs", {
      project_type_id: projectType.id,
      filename: spec.filename,
      content: spec.content,
      updated_by: AUTHOR,
    });
    await api("POST", `/api/v1/specs/${draft.id}/publish`, { published_by: AUTHOR });
    console.log(`  + ${spec.filename} (published 1.0.0)`);
    created++;
  }
  return created;
}

async function main() {
  console.log(`Loading AI-SDD sample pack into ${SERVER}\n`);

  // 1. Org-wide process specs -> the seeded Global project type.
  const types = await api("GET", "/api/v1/project-types");
  const global = types.find((t) => t.scope === "global");
  if (!global) {
    throw new Error('No global-scope project type found. Start the server so it seeds "Global" first.');
  }
  console.log(`Global process specifications → "${global.name}":`);
  const globalCount = await loadSpecsInto(global, readSpecs("global"));

  // 2. Technical contract specs -> the Embedded Systems Platform project type.
  const platform = await ensureProjectType(PROJECT_TYPE.name, PROJECT_TYPE);
  console.log(`\nTechnical specifications → "${platform.name}":`);
  const platformCount = await loadSpecsInto(platform, readSpecs(PROJECT_TYPE.dir));

  console.log(
    `\nDone. Published ${globalCount} global spec(s) and ${platformCount} platform spec(s).` +
      (globalCount + platformCount === 0 ? " (Everything was already loaded.)" : "")
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
