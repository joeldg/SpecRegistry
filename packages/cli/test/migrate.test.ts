import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { runMigrate } from "../src/migrate.js";

function response(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" }, ...init });
}

function withMockedFetch(handler: (url: URL, init?: RequestInit) => Response | Promise<Response>) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => handler(new URL(String(input)), init)) as typeof fetch;
  return () => {
    globalThis.fetch = originalFetch;
  };
}

const PROJECT_TYPE = "CLI Tool";
const TYPE_ROW = { id: "t1", name: PROJECT_TYPE, scope: "project_type", industry: null, description: null, created_at: "", updated_at: "" };

function withWorkspace(opts: { recordedKey?: string; projectContent?: string }): () => void {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "specreg-migrate-"));
  const specsDir = path.join(root, "specs");
  fs.mkdirSync(specsDir, { recursive: true });
  const manifest = {
    project_type: PROJECT_TYPE,
    ...(opts.recordedKey ? { registry: { url: "http://old-registry:4000", public_key: opts.recordedKey } } : {}),
    specs: [
      { filename: "GLOBAL.md", version: "1.0.0", project_type: "Global" },
      { filename: "CLI.md", version: "1.0.0", project_type: PROJECT_TYPE },
      { filename: "PROJECT.md", version: "1.0.0", project_type: "github.com/acme/repo" },
    ],
  };
  fs.writeFileSync(path.join(specsDir, ".specregistry.json"), JSON.stringify(manifest, null, 2));
  fs.writeFileSync(path.join(specsDir, "PROJECT.md"), opts.projectContent ?? "# Project spec\n\nLocal content.\n");
  const originalCwd = process.cwd();
  process.chdir(root);
  return () => process.chdir(originalCwd);
}

function captureLogs(): { logs: string[]; restore: () => void } {
  const logs: string[] = [];
  const original = console.log;
  console.log = (...args: unknown[]) => logs.push(args.map(String).join(" "));
  return { logs, restore: () => (console.log = original) };
}

const baseHandler = (targetKey: string, targetSpecs: unknown[]) => (url: URL) => {
  if (url.pathname === "/api/v1/meta/public-key") return response({ algorithm: "ed25519", public_key: targetKey });
  if (url.pathname === "/api/v1/project-types") return response([TYPE_ROW]);
  if (url.pathname === "/api/v1/cli/manifest-report") return response({ project_id: "p1" });
  if (url.pathname === "/api/v1/specs" && url.search.includes("project_id=p1")) return response(targetSpecs);
  throw new Error(`Unexpected request: ${url.pathname}${url.search}`);
};

test("migrate is a no-op when the target registry key matches the recorded one", async () => {
  const restoreCwd = withWorkspace({ recordedKey: "SAMEKEY" });
  const restoreFetch = withMockedFetch(baseHandler("SAMEKEY", []));
  const { logs, restore } = captureLogs();
  try {
    await runMigrate({ toServer: "http://new:4000", dir: "specs", apply: false, author: "alice", force: false });
    assert.match(logs.join("\n"), /already governed by .*Nothing to migrate/s);
  } finally {
    restore();
    restoreFetch();
    restoreCwd();
  }
});

test("dry-run plans an upload for a repo-owned spec missing on the target, without uploading", async () => {
  const restoreCwd = withWorkspace({ recordedKey: "OLDKEY" });
  let uploads = 0;
  const restoreFetch = withMockedFetch((url) => {
    if (url.pathname === "/api/v1/specs" && !url.search) {
      uploads++;
      return response({ id: "s1", status: "draft" }, { status: 201 });
    }
    return baseHandler("NEWKEY", [])(url);
  });
  const { logs, restore } = captureLogs();
  try {
    await runMigrate({ toServer: "http://new:4000", dir: "specs", apply: false, author: "alice", force: false });
    const out = logs.join("\n");
    assert.match(out, /PROJECT\.md: NEW/);
    assert.match(out, /Dry run/);
    assert.equal(uploads, 0, "dry run must not upload");
  } finally {
    restore();
    restoreFetch();
    restoreCwd();
  }
});

test("--apply uploads a missing repo-owned spec as a draft and re-stamps the manifest", async () => {
  const restoreCwd = withWorkspace({ recordedKey: "OLDKEY" });
  const posted: Array<Record<string, unknown>> = [];
  const restoreFetch = withMockedFetch((url, init) => {
    if (url.pathname === "/api/v1/specs" && init?.method === "POST") {
      posted.push(JSON.parse(String(init.body)));
      return response({ id: "s1", status: "draft" }, { status: 201 });
    }
    return baseHandler("NEWKEY", [])(url);
  });
  const { restore } = captureLogs();
  try {
    await runMigrate({ toServer: "http://new:4000", dir: "specs", apply: true, author: "alice", force: false });
    assert.equal(posted.length, 1);
    assert.equal(posted[0].filename, "PROJECT.md");
    const manifest = JSON.parse(fs.readFileSync(path.join(process.cwd(), "specs", ".specregistry.json"), "utf8"));
    assert.equal(manifest.registry.public_key, "NEWKEY");
    assert.equal(manifest.registry.url, "http://new:4000");
    assert.ok(manifest.registry.stamped_at);
  } finally {
    restore();
    restoreFetch();
    restoreCwd();
  }
});

test("--apply opens a change request when a published target spec differs", async () => {
  const restoreCwd = withWorkspace({ recordedKey: "OLDKEY", projectContent: "# Project spec\n\nNEW local content.\n" });
  const targetSpec = { id: "s2", filename: "PROJECT.md", status: "published", effective_scope: "project", current_version: "1.0.0" };
  let reviewOpened = false;
  const restoreFetch = withMockedFetch((url, init) => {
    if (url.pathname === "/api/v1/specs/s2") return response({ id: "s2", filename: "PROJECT.md", content: "# Project spec\n\nOLD target content.\n" });
    if (url.pathname === "/api/v1/specs/review" && init?.method === "POST") {
      reviewOpened = true;
      return response({ id: "cr1" });
    }
    return baseHandler("NEWKEY", [targetSpec])(url);
  });
  const { logs, restore } = captureLogs();
  try {
    await runMigrate({ toServer: "http://new:4000", dir: "specs", apply: true, author: "alice", force: false });
    assert.equal(reviewOpened, true, "a differing published spec should open a change request");
    assert.match(logs.join("\n"), /change request cr1/);
  } finally {
    restore();
    restoreFetch();
    restoreCwd();
  }
});
