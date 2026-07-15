import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { checkSkillCurrency, installAgentSkills, renderAgentSkill, resolveAgentSkills, runSkillsCommand, type AgentSkill } from "../src/skills.js";

const catalog: AgentSkill[] = [
  { id: "1", slug: "load-specs", name: "Load specs", description: "Load governed specs.", instructions: "Call get_specs.", risk_level: "safe", status: "active", built_in: 1, created_at: "", updated_at: "" },
  { id: "2", slug: "deploy", name: "Deploy", description: "Prepare a deployment.", instructions: "Require approval.", risk_level: "restricted", status: "active", built_in: 0, created_at: "", updated_at: "" },
];

test("base skill selection includes only active built-in safe skills", () => {
  assert.deepEqual(resolveAgentSkills(catalog).map((skill) => skill.slug), ["load-specs"]);
  assert.deepEqual(resolveAgentSkills(catalog, "all").map((skill) => skill.slug), ["load-specs", "deploy"]);
  assert.deepEqual(resolveAgentSkills(catalog, "2").map((skill) => skill.slug), ["deploy"]);
});

test("rendered skills carry provenance, risk, and a safety boundary", () => {
  const markdown = renderAgentSkill(catalog[1]);
  assert.match(markdown, /name: deploy/);
  assert.match(markdown, /risk_level: restricted/);
  assert.match(markdown, /source_url:/);
  assert.match(markdown, /not permission to take external or destructive/);
});

test("skill currency detects registry version drift", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "specreg-skills-"));
  const previous = process.cwd();
  const server = http.createServer((req, res) => {
    if (req.url === "/api/v1/skills") {
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify([{ ...catalog[0], current_version: "1.0.1", content_hash: "registryhash" }]));
      return;
    }
    res.statusCode = 404;
    res.end("not found");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    process.chdir(tmp);
    installAgentSkills([{ ...catalog[0], current_version: "1.0.0", content_hash: "localhash" }], ".spec/skills", true);
    const address = server.address();
    assert(address && typeof address === "object");
    const report = await checkSkillCurrency({ server: `http://127.0.0.1:${address.port}`, dir: ".spec/skills" });
    assert.equal(report.drift, true);
    assert.equal(report.outdated[0].local.slug, "load-specs");
    assert.match(report.outdated[0].reason, /registry hash changed/);
  } finally {
    process.chdir(previous);
    await new Promise<void>((resolve) => server.close(() => resolve()));
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("marketplace commands search, add sources, scan sources, and list candidates", async () => {
  const requests: Array<{ method?: string; url?: string; body?: string }> = [];
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => {
      body += String(chunk);
    });
    req.on("end", () => {
      requests.push({ method: req.method, url: req.url, body });
      res.setHeader("content-type", "application/json");
      if (req.method === "GET" && req.url === "/api/v1/skills") {
        res.end(JSON.stringify(catalog));
        return;
      }
      if (req.method === "GET" && req.url === "/api/v1/skills/candidates") {
        res.end(JSON.stringify([{ id: "cand-1", source_id: "src-1", source_url: "https://github.com/acme/skills", source_path: "skills/deploy/SKILL.md", source_commit: "abc", candidate_type: "agent_skill", proposed_name: "Deploy candidate", proposed_slug: "deploy-candidate", risk_level: "safe", risk_summary: "Looks bounded.", gate_status: "pass", status: "candidate", updated_at: "" }]));
        return;
      }
      if (req.method === "GET" && req.url === "/api/v1/skills/sources") {
        res.end(JSON.stringify([{ id: "src-1", url: "https://github.com/acme/skills", provider: "github", source_type: "github_repo", license: "MIT", default_branch: null, last_fetched_commit: null, last_scan_at: null, status: "active", trust_decision: "unreviewed", notes: "starter", created_at: "", updated_at: "" }]));
        return;
      }
      if (req.method === "POST" && req.url === "/api/v1/skills/sources") {
        const parsed = JSON.parse(body) as { url: string; source_type: string; license?: string; notes?: string };
        res.end(JSON.stringify({ id: "src-2", url: parsed.url, provider: "github", source_type: parsed.source_type, license: parsed.license ?? null, default_branch: null, last_fetched_commit: null, last_scan_at: null, status: "active", trust_decision: "unreviewed", notes: parsed.notes ?? null, created_at: "", updated_at: "" }));
        return;
      }
      if (req.method === "POST" && req.url === "/api/v1/skills/sources/src-1/scan") {
        res.end(JSON.stringify({ source_id: "src-1", scanned: 1, created: 1, skipped: 0, candidates: [{ id: "cand-1", source_path: "skills/deploy/SKILL.md", proposed_name: "Deploy candidate", candidate_type: "agent_skill", gate_status: "pass", created: true }] }));
        return;
      }
      res.statusCode = 404;
      res.end(JSON.stringify({ message: "not found" }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const logs: string[] = [];
  const originalLog = console.log;
  console.log = (...args: unknown[]) => {
    logs.push(args.join(" "));
  };
  try {
    const address = server.address();
    assert(address && typeof address === "object");
    const base = `http://127.0.0.1:${address.port}`;
    await runSkillsCommand({ server: base, subcommand: "search", args: ["deploy"] });
    await runSkillsCommand({ server: base, subcommand: "sources", args: ["list"] });
    await runSkillsCommand({ server: base, subcommand: "sources", args: ["add", "https://github.com/acme/new-skills"], sourceType: "github_repo", license: "Apache-2.0", notes: "test" });
    await runSkillsCommand({ server: base, subcommand: "sources", args: ["scan", "src-1"] });
    await runSkillsCommand({ server: base, subcommand: "candidates", args: ["list"] });
    assert(logs.some((line) => line.includes("Skills (1)")));
    assert(logs.some((line) => line.includes("Added skill source: src-2")));
    assert(logs.some((line) => line.includes("Scanned 1 file(s): 1 created, 0 skipped.")));
    assert(logs.some((line) => line.includes("deploy-candidate")));
    const addRequest = requests.find((request) => request.method === "POST" && request.url === "/api/v1/skills/sources");
    assert(addRequest?.body.includes("Apache-2.0"));
  } finally {
    console.log = originalLog;
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
