import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { runComply } from "../src/comply.js";
import { resolveRegistryWorkspace } from "../src/workspace.js";

function response(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

test("comply resolves the initialized registry root from a subdirectory", async () => {
  const originalFetch = globalThis.fetch;
  const originalCwd = process.cwd();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "specreg-comply-root-"));
  fs.mkdirSync(path.join(root, "specs"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "specs", ".specregistry.json"),
    JSON.stringify({ project_type: "CLI Tool / Developer Tooling", specs: [{ filename: "CLI.md", version: "1.0.0" }] }) + "\n"
  );
  fs.writeFileSync(path.join(root, "specs", "CLI.md"), "# CLI\n\n## Commands\n\nThe tool exposes a comply command.\n");
  fs.mkdirSync(path.join(root, "src", "commands"), { recursive: true });
  fs.writeFileSync(path.join(root, "src", "commands", "comply.ts"), "export function complyCommand() { return 'ok'; }\n");
  const nested = path.join(root, "src", "commands");
  const bodies: any[] = [];

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    assert.equal(url.pathname, "/api/v1/ai/compliance-check");
    bodies.push(JSON.parse(String(init?.body)));
    return response({
      compliant: true,
      objective_score: 100,
      self_assessed_score: null,
      over_claimed: false,
      coverage_ratio: 1,
      drift_score: 0,
      iteration: 1,
      outstanding: [],
      directive: "COMPLIANT",
    });
  }) as typeof fetch;

  try {
    process.chdir(nested);
    const workspace = resolveRegistryWorkspace("specs");
    assert.equal(fs.realpathSync(workspace.root), fs.realpathSync(root));
    assert.equal(workspace.manifest?.project_type, "CLI Tool / Developer Tooling");
    await runComply({
      server: "https://specreg.example.com",
      type: workspace.manifest!.project_type,
      dir: workspace.specsDir,
      root: workspace.root,
    });
  } finally {
    globalThis.fetch = originalFetch;
    process.chdir(originalCwd);
  }

  assert.ok(fs.existsSync(path.join(root, ".spec", "code-trace.json")));
  assert.equal(fs.existsSync(path.join(nested, ".spec", "code-trace.json")), false);
  assert.equal(bodies[0].project_type, "CLI Tool / Developer Tooling");
});
