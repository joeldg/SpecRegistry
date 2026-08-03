import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { runAgentState } from "../src/agentState.js";

function response(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}

test("state sync uploads local spec changes and stages differing peer snapshots outside governed specs", async () => {
  const originalCwd = process.cwd();
  const originalFetch = globalThis.fetch;
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "specreg-agent-state-"));
  const specs = path.join(root, "specs");
  fs.mkdirSync(specs, { recursive: true });
  const baseline = "# Design\n\nBaseline.\n";
  const baselineHash = crypto.createHash("sha256").update(baseline).digest("hex");
  fs.writeFileSync(path.join(specs, "DESIGN.md"), "# Design\n\nLocal edit.\n");
  fs.writeFileSync(path.join(specs, ".specregistry.json"), JSON.stringify({
    project_type: "Web App Standard",
    project: "github.com/acme/app",
    specs: [{ filename: "DESIGN.md", version: "1.0.0", sha256: baselineHash }],
  }));
  let uploaded: any;
  process.chdir(root);
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.pathname === "/api/v1/cli/manifest-report") return response({ project_id: "p1" });
    if (url.pathname === "/api/v1/cli/agent-state" && init?.method === "POST") {
      uploaded = JSON.parse(String(init.body));
      return response({ ...uploaded, id: "state-local", updated_at: "now" });
    }
    if (url.pathname === "/api/v1/cli/agent-state") {
      return response([{
        workspace_id: "workstation-b",
        agent_identifier: "other-agent",
        branch: "feature/other",
        commit_sha: "def456",
        manifest_hash: "peer-manifest",
        updated_at: "now",
        spec_changes: [{ filename: "DESIGN.md", status: "modified", base_sha256: baselineHash, sha256: "peer", content: "# Design\n\nPeer edit.\n" }],
      }]);
    }
    throw new Error(`Unexpected request: ${url.pathname}`);
  }) as typeof fetch;

  try {
    await runAgentState({ server: "https://registry.example.com", dir: "specs", action: "sync", agentIdentifier: "codex" });
    assert.equal(uploaded.repo, "github.com/acme/app");
    assert.equal(uploaded.spec_changes[0].filename, "DESIGN.md");
    assert.equal(uploaded.spec_changes[0].status, "modified");
    assert.equal(fs.readFileSync(path.join(root, ".spec", "incoming", "workstation-b", "DESIGN.md"), "utf8"), "# Design\n\nPeer edit.\n");
    assert.equal(fs.readFileSync(path.join(specs, "DESIGN.md"), "utf8"), "# Design\n\nLocal edit.\n");
  } finally {
    globalThis.fetch = originalFetch;
    process.chdir(originalCwd);
  }
});
