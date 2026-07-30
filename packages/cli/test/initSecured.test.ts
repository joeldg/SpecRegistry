import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import AdmZip from "adm-zip";
import { runInit } from "../src/init.js";

function response(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

test("secured premade init enrolls before authenticated registry lookups", async () => {
  const originalFetch = globalThis.fetch;
  const originalCwd = process.cwd();
  const originalRepo = process.env.SPECREG_REPO;
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "specreg-init-secured-"));
  const calls: Array<{ path: string; auth: string | null }> = [];
  const zip = new AdmZip();
  zip.addFile(
    ".specregistry.json",
    Buffer.from(JSON.stringify({ project_type: "Web App Standard", project: "github.com/dogfood/init-secured", specs: [{ filename: "ONE.md", version: "1.0.0" }] }))
  );
  zip.addFile("ONE.md", Buffer.from("# One\n\n## Requirements\n\nTrace this.\n"));

  process.chdir(root);
  process.env.SPECREG_REPO = "github.com/dogfood/init-secured";
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    calls.push({ path: url.pathname, auth: new Headers(init?.headers).get("authorization") });
    if (url.pathname === "/api/v1/agents/enroll") {
      return response({ token: "agent-token", username: "agent-init", role: "agent" });
    }
    if (url.pathname === "/api/v1/project-types") {
      assert.equal(new Headers(init?.headers).get("authorization"), "Bearer agent-token");
      return response([
        {
          id: "type-1",
          name: "Web App Standard",
          scope: "project_type",
          industry: "Software",
          description: "Web apps",
          required_reviewers: "[]",
          created_at: "",
          updated_at: "",
        },
      ]);
    }
    if (url.pathname === "/api/v1/skills") {
      assert.equal(new Headers(init?.headers).get("authorization"), "Bearer agent-token");
      return response([]);
    }
    if (url.pathname === "/api/v1/specs/type-1/download") {
      assert.equal(new Headers(init?.headers).get("authorization"), "Bearer agent-token");
      return new Response(zip.toBuffer(), { status: 200 });
    }
    if (url.pathname === "/api/v1/meta/public-key") {
      return response({ algorithm: "ed25519", public_key: "PUBLICKEY" });
    }
    if (url.pathname === "/api/v1/cli/manifest-report") {
      assert.equal(new Headers(init?.headers).get("authorization"), "Bearer agent-token");
      return response({ project_id: "project-1" });
    }
    throw new Error(`Unexpected request: ${url.pathname}`);
  }) as typeof fetch;

  try {
    await runInit({
      server: "https://specreg.example.com",
      type: "Web App Standard",
      dir: "specs",
      force: true,
      styleguides: "none",
      styleguideDir: ".spec/styleguides",
      skills: "none",
      skillDir: ".spec/skills",
    });
  } finally {
    globalThis.fetch = originalFetch;
    process.chdir(originalCwd);
    if (originalRepo === undefined) delete process.env.SPECREG_REPO;
    else process.env.SPECREG_REPO = originalRepo;
  }

  assert.equal(calls[0]?.path, "/api/v1/agents/enroll");
  assert.deepEqual(
    calls.map((call) => call.path),
    [
      "/api/v1/agents/enroll",
      "/api/v1/project-types",
      "/api/v1/skills",
      "/api/v1/specs/type-1/download",
      "/api/v1/meta/public-key",
      "/api/v1/cli/manifest-report",
    ]
  );
  assert.ok(fs.existsSync(path.join(root, ".spec/credentials.json")));
  assert.ok(fs.readFileSync(path.join(root, ".mcp.json"), "utf8").includes("agent-token"));
});

test("premade init downloads specs by route-safe project type id", async () => {
  const originalFetch = globalThis.fetch;
  const originalCwd = process.cwd();
  const originalRepo = process.env.SPECREG_REPO;
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "specreg-init-slash-type-"));
  const calls: string[] = [];
  const zip = new AdmZip();
  zip.addFile(
    ".specregistry.json",
    Buffer.from(JSON.stringify({ project_type: "CLI Tool / Developer Tooling", specs: [{ filename: "CLI.md", version: "1.0.0" }] }))
  );
  zip.addFile("CLI.md", Buffer.from("# CLI\n\n## Requirements\n\nNo encoded slash routes.\n"));

  process.chdir(root);
  process.env.SPECREG_REPO = "github.com/dogfood/cli-tool";
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    calls.push(url.pathname);
    if (url.pathname === "/api/v1/project-types") {
      return response([
        {
          id: "cli-tool-type",
          name: "CLI Tool / Developer Tooling",
          scope: "project_type",
          industry: "Software",
          description: "CLI tools",
          required_reviewers: "[]",
          created_at: "",
          updated_at: "",
        },
      ]);
    }
    if (url.pathname === "/api/v1/skills") return response([]);
    if (url.pathname === "/api/v1/specs/cli-tool-type/download") return new Response(zip.toBuffer(), { status: 200 });
    if (url.pathname === "/api/v1/meta/public-key") return response({ algorithm: "ed25519", public_key: "PUBLICKEY" });
    if (url.pathname === "/api/v1/cli/manifest-report") return response({ project_id: "project-1" });
    throw new Error(`Unexpected request: ${url.pathname}`);
  }) as typeof fetch;

  try {
    await runInit({
      server: "https://specreg.example.com",
      type: "CLI Tool / Developer Tooling",
      dir: "specs",
      force: true,
      styleguides: "none",
      styleguideDir: ".spec/styleguides",
      skills: "none",
      skillDir: ".spec/skills",
    });
  } finally {
    globalThis.fetch = originalFetch;
    process.chdir(originalCwd);
    if (originalRepo === undefined) delete process.env.SPECREG_REPO;
    else process.env.SPECREG_REPO = originalRepo;
  }

  assert.ok(calls.includes("/api/v1/specs/cli-tool-type/download"));
  assert.ok(!calls.some((path) => path.includes("%2F")));
  assert.ok(fs.existsSync(path.join(root, "specs/CLI.md")));
});

test("sync-style init preserves canonical repo identity, stamps the registry, and removes retired governed files", async () => {
  const originalFetch = globalThis.fetch;
  const originalCwd = process.cwd();
  const originalRepo = process.env.SPECREG_REPO;
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "specreg-init-reconcile-"));
  const specsDir = path.join(root, "specs");
  fs.mkdirSync(specsDir, { recursive: true });
  const oldKeep = "# Keep\n\nOld approved content.\n";
  const retired = "# Retired\n\nNo longer governed.\n";
  const newKeep = "# Keep\n\nNew approved content.\n";
  const digest = (content: string) => crypto.createHash("sha256").update(content).digest("hex");
  fs.writeFileSync(path.join(specsDir, "KEEP.md"), oldKeep);
  fs.writeFileSync(path.join(specsDir, "RETIRED.md"), retired);
  fs.writeFileSync(
    path.join(specsDir, ".specregistry.json"),
    JSON.stringify({
      project_type: "Web App Standard",
      project: "github.com/acme/renamed-repo",
      specs: [
        { filename: "KEEP.md", version: "1.0.0", sha256: digest(oldKeep) },
        { filename: "RETIRED.md", version: "1.0.0", sha256: digest(retired) },
      ],
      registry: { url: "https://registry.example.com", public_key: "PUBLICKEY" },
    })
  );
  const zip = new AdmZip();
  zip.addFile(
    ".specregistry.json",
    Buffer.from(JSON.stringify({
      project_type: "Web App Standard",
      project: "github.com/acme/renamed-repo",
      specs: [{ filename: "KEEP.md", version: "2.0.0", sha256: digest(newKeep) }],
      signature: "signed",
      signature_alg: "ed25519",
    }))
  );
  zip.addFile("KEEP.md", Buffer.from(newKeep));
  let downloadRepo: string | null = null;
  let reportedRepo: string | undefined;

  process.chdir(root);
  process.env.SPECREG_REPO = "github.com/acme/old-repo";
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.pathname === "/api/v1/project-types") {
      return response([{ id: "type-1", name: "Web App Standard", scope: "project_type", industry: null, description: null }]);
    }
    if (url.pathname === "/api/v1/skills") return response([]);
    if (url.pathname === "/api/v1/specs/type-1/download") {
      downloadRepo = url.searchParams.get("repo");
      return new Response(zip.toBuffer(), { status: 200 });
    }
    if (url.pathname === "/api/v1/meta/public-key") {
      return response({ algorithm: "ed25519", public_key: "PUBLICKEY" });
    }
    if (url.pathname === "/api/v1/cli/manifest-report") {
      reportedRepo = JSON.parse(String(init?.body)).repo;
      return response({ project_id: "project-1" });
    }
    throw new Error(`Unexpected request: ${url.pathname}`);
  }) as typeof fetch;

  try {
    await runInit({
      server: "https://registry.example.com",
      token: "token",
      type: "Web App Standard",
      dir: "specs",
      force: false,
      styleguides: "none",
      styleguideDir: ".spec/styleguides",
      skills: "none",
      skillDir: ".spec/skills",
    });
  } finally {
    globalThis.fetch = originalFetch;
    process.chdir(originalCwd);
    if (originalRepo === undefined) delete process.env.SPECREG_REPO;
    else process.env.SPECREG_REPO = originalRepo;
  }

  const manifest = JSON.parse(fs.readFileSync(path.join(specsDir, ".specregistry.json"), "utf8"));
  assert.equal(downloadRepo, "github.com/acme/renamed-repo");
  assert.equal(reportedRepo, "github.com/acme/renamed-repo");
  assert.equal(fs.readFileSync(path.join(specsDir, "KEEP.md"), "utf8"), newKeep);
  assert.equal(fs.existsSync(path.join(specsDir, "RETIRED.md")), false);
  assert.equal(manifest.registry.url, "https://registry.example.com");
  assert.equal(manifest.registry.public_key, "PUBLICKEY");
  assert.ok(manifest.registry.stamped_at);
});

test("sync-style init rejects a different registry identity before changing governed files", async () => {
  const originalFetch = globalThis.fetch;
  const originalCwd = process.cwd();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "specreg-init-registry-mismatch-"));
  const specsDir = path.join(root, "specs");
  fs.mkdirSync(specsDir, { recursive: true });
  fs.writeFileSync(path.join(specsDir, "KEEP.md"), "# Existing\n");
  fs.writeFileSync(
    path.join(specsDir, ".specregistry.json"),
    JSON.stringify({
      project_type: "Web App Standard",
      project: "github.com/acme/repo",
      specs: [{ filename: "KEEP.md", version: "1.0.0" }],
      registry: { url: "https://old.example.com", public_key: "OLDKEY" },
    })
  );
  const zip = new AdmZip();
  zip.addFile(
    ".specregistry.json",
    Buffer.from(JSON.stringify({
      project_type: "Web App Standard",
      project: "github.com/acme/repo",
      specs: [{ filename: "KEEP.md", version: "2.0.0" }],
    }))
  );
  zip.addFile("KEEP.md", Buffer.from("# Replacement\n"));

  process.chdir(root);
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    if (url.pathname === "/api/v1/project-types") {
      return response([{ id: "type-1", name: "Web App Standard", scope: "project_type", industry: null, description: null }]);
    }
    if (url.pathname === "/api/v1/skills") return response([]);
    if (url.pathname === "/api/v1/specs/type-1/download") return new Response(zip.toBuffer(), { status: 200 });
    if (url.pathname === "/api/v1/meta/public-key") {
      return response({ algorithm: "ed25519", public_key: "NEWKEY" });
    }
    throw new Error(`Unexpected request: ${url.pathname}`);
  }) as typeof fetch;

  try {
    await assert.rejects(
      runInit({
        server: "https://new.example.com",
        token: "token",
        type: "Web App Standard",
        dir: "specs",
        force: true,
        styleguides: "none",
        styleguideDir: ".spec/styleguides",
        skills: "none",
        skillDir: ".spec/skills",
      }),
      /Registry identity changed.*specreg migrate/
    );
    assert.equal(fs.readFileSync(path.join(specsDir, "KEEP.md"), "utf8"), "# Existing\n");
  } finally {
    globalThis.fetch = originalFetch;
    process.chdir(originalCwd);
  }
});

test("sync-style init protects a locally edited retired governed file", async () => {
  const originalFetch = globalThis.fetch;
  const originalCwd = process.cwd();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "specreg-init-retired-edit-"));
  const specsDir = path.join(root, "specs");
  fs.mkdirSync(specsDir, { recursive: true });
  const approved = "# Retired approved\n";
  const edited = "# Retired locally edited\n";
  const approvedHash = crypto.createHash("sha256").update(approved).digest("hex");
  fs.writeFileSync(path.join(specsDir, "RETIRED.md"), edited);
  fs.writeFileSync(
    path.join(specsDir, ".specregistry.json"),
    JSON.stringify({
      project_type: "Web App Standard",
      project: "github.com/acme/repo",
      specs: [{ filename: "RETIRED.md", version: "1.0.0", sha256: approvedHash }],
      registry: { url: "https://registry.example.com", public_key: "PUBLICKEY" },
    })
  );
  const zip = new AdmZip();
  zip.addFile(
    ".specregistry.json",
    Buffer.from(JSON.stringify({
      project_type: "Web App Standard",
      project: "github.com/acme/repo",
      specs: [],
    }))
  );

  process.chdir(root);
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    if (url.pathname === "/api/v1/project-types") {
      return response([{ id: "type-1", name: "Web App Standard", scope: "project_type", industry: null, description: null }]);
    }
    if (url.pathname === "/api/v1/skills") return response([]);
    if (url.pathname === "/api/v1/specs/type-1/download") return new Response(zip.toBuffer(), { status: 200 });
    if (url.pathname === "/api/v1/meta/public-key") {
      return response({ algorithm: "ed25519", public_key: "PUBLICKEY" });
    }
    throw new Error(`Unexpected request: ${url.pathname}`);
  }) as typeof fetch;

  try {
    await assert.rejects(
      runInit({
        server: "https://registry.example.com",
        token: "token",
        type: "Web App Standard",
        dir: "specs",
        force: false,
        styleguides: "none",
        styleguideDir: ".spec/styleguides",
        skills: "none",
        skillDir: ".spec/skills",
      }),
      /RETIRED\.md.*--force/
    );
    assert.equal(fs.readFileSync(path.join(specsDir, "RETIRED.md"), "utf8"), edited);
  } finally {
    globalThis.fetch = originalFetch;
    process.chdir(originalCwd);
  }
});
