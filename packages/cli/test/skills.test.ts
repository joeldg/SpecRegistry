import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { checkSkillCurrency, installAgentSkills, renderAgentSkill, resolveAgentSkills, type AgentSkill } from "../src/skills.js";

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
