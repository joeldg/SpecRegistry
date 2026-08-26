import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { detectTaskSystem } from "../src/task.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeTmpRepo(hasGithubRemote: boolean, customRemote?: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specreg-task-test-"));
  const gitDir = path.join(dir, ".git");
  fs.mkdirSync(gitDir);
  const remote =
    customRemote ??
    (hasGithubRemote
      ? "url = https://github.com/acme/my-app.git"
      : "url = https://gitlab.com/acme/my-app.git");
  fs.writeFileSync(
    path.join(gitDir, "config"),
    `[core]\n\trepositoryformatversion = 0\n[remote "origin"]\n\t${remote}\n`
  );
  return dir;
}

// A GitHub-backed working dir where the GitHub API is stubbed to look unreachable,
// so `task open --allow-local-fallback` exercises the emergency local .tasks/ path.
function makeGithubRepoWithOutage(prefix: string): {
  dir: string;
  restore: () => void;
} {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const gitDir = path.join(dir, ".git");
  fs.mkdirSync(gitDir);
  fs.writeFileSync(
    path.join(gitDir, "config"),
    `[core]\n\trepositoryformatversion = 0\n[remote "origin"]\n\turl = https://github.com/acme/my-app.git\n`
  );
  const origFetch = globalThis.fetch;
  const origToken = process.env.SPECREG_GITHUB_TOKEN;
  process.env.SPECREG_GITHUB_TOKEN = "test-token";
  // Simulate an API outage for any GitHub call.
  globalThis.fetch = (async () => {
    throw new Error("simulated network outage");
  }) as typeof fetch;
  return {
    dir,
    restore: () => {
      globalThis.fetch = origFetch;
      if (origToken === undefined) delete process.env.SPECREG_GITHUB_TOKEN;
      else process.env.SPECREG_GITHUB_TOKEN = origToken;
    },
  };
}

function parseFrontmatterStatus(filePath: string): string {
  const content = fs.readFileSync(filePath, "utf8");
  const m = content.match(/^status:\s*(\S+)$/m);
  return m ? m[1] : "";
}

function parseFrontmatterField(filePath: string, field: string): string {
  const content = fs.readFileSync(filePath, "utf8");
  const m = content.match(new RegExp(`^${field}:\\s*(.+)$`, "m"));
  return m ? m[1].trim().replace(/^"|"$/g, "") : "";
}

// ─── detectTaskSystem ─────────────────────────────────────────────────────────

test("detectTaskSystem: returns local when no .git/config exists", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specreg-task-"));
  try {
    const result = detectTaskSystem(dir);
    assert.equal(result.system, "local");
  } finally {
    fs.rmSync(dir, { recursive: true });
  }
});

test("detectTaskSystem: returns github for github.com HTTPS remote", () => {
  const dir = makeTmpRepo(true);
  try {
    const result = detectTaskSystem(dir);
    assert.equal(result.system, "github");
    assert.equal(result.owner, "acme");
    assert.equal(result.repo, "my-app");
  } finally {
    fs.rmSync(dir, { recursive: true });
  }
});

test("detectTaskSystem: returns github for github.com SSH remote", () => {
  const dir = makeTmpRepo(true, "url = git@github.com:acme/my-app.git");
  try {
    const result = detectTaskSystem(dir);
    assert.equal(result.system, "github");
    assert.equal(result.owner, "acme");
    assert.equal(result.repo, "my-app");
  } finally {
    fs.rmSync(dir, { recursive: true });
  }
});

test("detectTaskSystem: returns local for non-github remote", () => {
  const dir = makeTmpRepo(false);
  try {
    const result = detectTaskSystem(dir);
    assert.equal(result.system, "local");
  } finally {
    fs.rmSync(dir, { recursive: true });
  }
});

// ─── task open: GitHub-mandatory policy ────────────────────────────────────────

test("task open: throws when repo is not GitHub-backed", async () => {
  const { runTaskCommand } = await import("../src/task.js");
  const tmpDir = makeTmpRepo(false);
  const origDir = process.cwd();
  try {
    process.chdir(tmpDir);
    await assert.rejects(
      () => runTaskCommand({ subcommand: "open", args: [], title: "No github", dir: ".tasks" }),
      /GitHub Issues are the mandatory task system of record/
    );
  } finally {
    process.chdir(origDir);
    fs.rmSync(tmpDir, { recursive: true });
  }
});

test("task open: throws when GitHub-backed but no token is configured", async () => {
  const { runTaskCommand } = await import("../src/task.js");
  const tmpDir = makeTmpRepo(true);
  const origDir = process.cwd();
  const origToken = process.env.SPECREG_GITHUB_TOKEN;
  const origGh = process.env.GITHUB_TOKEN;
  try {
    delete process.env.SPECREG_GITHUB_TOKEN;
    delete process.env.GITHUB_TOKEN;
    process.chdir(tmpDir);
    await assert.rejects(
      () => runTaskCommand({ subcommand: "open", args: [], title: "No token", dir: ".tasks" }),
      /no GitHub token is configured/
    );
  } finally {
    process.chdir(origDir);
    if (origToken !== undefined) process.env.SPECREG_GITHUB_TOKEN = origToken;
    if (origGh !== undefined) process.env.GITHUB_TOKEN = origGh;
    fs.rmSync(tmpDir, { recursive: true });
  }
});

test("task open: throws on API outage without --allow-local-fallback", async () => {
  const { runTaskCommand } = await import("../src/task.js");
  const { dir, restore } = makeGithubRepoWithOutage("specreg-task-outage-");
  const origDir = process.cwd();
  try {
    process.chdir(dir);
    await assert.rejects(
      () => runTaskCommand({ subcommand: "open", args: [], title: "Outage", dir: ".tasks" }),
      /GitHub Issues API is unreachable/
    );
    assert.ok(!fs.existsSync(path.join(dir, ".tasks")), "must not write a local file without opt-in");
  } finally {
    process.chdir(origDir);
    restore();
    fs.rmSync(dir, { recursive: true });
  }
});

// ─── emergency local fallback (GitHub-backed + API outage + opt-in) ─────────────

test("task open: creates first provisional local task file with id 0001 on outage", async () => {
  const { runTaskCommand } = await import("../src/task.js");
  const { dir, restore } = makeGithubRepoWithOutage("specreg-task-open-");
  const origDir = process.cwd();
  try {
    process.chdir(dir);
    await runTaskCommand({ subcommand: "open", args: [], title: "Add rate limiting", dir: ".tasks", allowLocalFallback: true });
    const tasksPath = path.join(dir, ".tasks");
    const files = fs.readdirSync(tasksPath);
    assert.equal(files.length, 1);
    assert.equal(files[0], "0001-add-rate-limiting.md");
    const filePath = path.join(tasksPath, files[0]);
    assert.equal(parseFrontmatterField(filePath, "id"), "0001");
    assert.equal(parseFrontmatterField(filePath, "title"), "Add rate limiting");
    assert.equal(parseFrontmatterStatus(filePath), "open");
    assert.equal(parseFrontmatterField(filePath, "branch"), "task/0001-add-rate-limiting");
    assert.equal(parseFrontmatterField(filePath, "github_fallback"), "true");
  } finally {
    process.chdir(origDir);
    restore();
    fs.rmSync(dir, { recursive: true });
  }
});

test("task open: increments id for second provisional task on outage", async () => {
  const { runTaskCommand } = await import("../src/task.js");
  const { dir, restore } = makeGithubRepoWithOutage("specreg-task-open-");
  const origDir = process.cwd();
  try {
    process.chdir(dir);
    await runTaskCommand({ subcommand: "open", args: [], title: "First task", dir: ".tasks", allowLocalFallback: true });
    await runTaskCommand({ subcommand: "open", args: [], title: "Second task", dir: ".tasks", allowLocalFallback: true });
    const files = fs.readdirSync(path.join(dir, ".tasks")).sort();
    assert.equal(files.length, 2);
    assert.ok(files[0].startsWith("0001-"), `Expected 0001- prefix, got: ${files[0]}`);
    assert.ok(files[1].startsWith("0002-"), `Expected 0002- prefix, got: ${files[1]}`);
  } finally {
    process.chdir(origDir);
    restore();
    fs.rmSync(dir, { recursive: true });
  }
});

test("task open: records spec_refs in provisional front-matter on outage", async () => {
  const { runTaskCommand } = await import("../src/task.js");
  const { dir, restore } = makeGithubRepoWithOutage("specreg-task-open-");
  const origDir = process.cwd();
  try {
    process.chdir(dir);
    await runTaskCommand({
      subcommand: "open",
      args: [],
      title: "Auth work",
      dir: ".tasks",
      specRefs: "GLOBAL_SECURITY.md#auth,API.md#endpoints",
      allowLocalFallback: true,
    });
    const files = fs.readdirSync(path.join(dir, ".tasks"));
    const filePath = path.join(dir, ".tasks", files[0]);
    const content = fs.readFileSync(filePath, "utf8");
    assert.ok(content.includes("GLOBAL_SECURITY.md#auth"), "Missing GLOBAL_SECURITY.md#auth");
    assert.ok(content.includes("API.md#endpoints"), "Missing API.md#endpoints");
  } finally {
    process.chdir(origDir);
    restore();
    fs.rmSync(dir, { recursive: true });
  }
});

// ─── task list ────────────────────────────────────────────────────────────────

test("task list: handles empty .tasks/ without error", async () => {
  const { runTaskCommand } = await import("../src/task.js");
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "specreg-task-list-"));
  const origDir = process.cwd();
  try {
    process.chdir(tmpDir);
    await runTaskCommand({ subcommand: "list", args: [], dir: ".tasks" });
  } finally {
    process.chdir(origDir);
    fs.rmSync(tmpDir, { recursive: true });
  }
});

test("task list: shows provisional tasks after outage fallback", async () => {
  const { runTaskCommand } = await import("../src/task.js");
  const { dir, restore } = makeGithubRepoWithOutage("specreg-task-list-");
  const origDir = process.cwd();
  try {
    process.chdir(dir);
    await runTaskCommand({ subcommand: "open", args: [], title: "Alpha", dir: ".tasks", allowLocalFallback: true });
    await runTaskCommand({ subcommand: "open", args: [], title: "Beta", dir: ".tasks", allowLocalFallback: true });
    const files = fs.readdirSync(path.join(dir, ".tasks")).sort();
    assert.equal(files.length, 2);
  } finally {
    process.chdir(origDir);
    restore();
    fs.rmSync(dir, { recursive: true });
  }
});

// ─── task update ─────────────────────────────────────────────────────────────

test("task update: sets status to in-progress", async () => {
  const { runTaskCommand } = await import("../src/task.js");
  const { dir, restore } = makeGithubRepoWithOutage("specreg-task-upd-");
  const origDir = process.cwd();
  try {
    process.chdir(dir);
    await runTaskCommand({ subcommand: "open", args: [], title: "Update me", dir: ".tasks", allowLocalFallback: true });
    await runTaskCommand({ subcommand: "update", args: ["0001"], status: "in-progress", dir: ".tasks" });
    const files = fs.readdirSync(path.join(dir, ".tasks"));
    const filePath = path.join(dir, ".tasks", files[0]);
    assert.equal(parseFrontmatterStatus(filePath), "in-progress");
  } finally {
    process.chdir(origDir);
    restore();
    fs.rmSync(dir, { recursive: true });
  }
});

// ─── task close ──────────────────────────────────────────────────────────────

test("task close: marks provisional task done", async () => {
  const { runTaskCommand } = await import("../src/task.js");
  const { dir, restore } = makeGithubRepoWithOutage("specreg-task-close-");
  const origDir = process.cwd();
  try {
    process.chdir(dir);
    await runTaskCommand({ subcommand: "open", args: [], title: "Close me", dir: ".tasks", allowLocalFallback: true });
    await runTaskCommand({ subcommand: "close", args: ["0001-close-me.md"], dir: ".tasks" });
    const files = fs.readdirSync(path.join(dir, ".tasks"));
    const filePath = path.join(dir, ".tasks", files[0]);
    assert.equal(parseFrontmatterStatus(filePath), "done");
  } finally {
    process.chdir(origDir);
    restore();
    fs.rmSync(dir, { recursive: true });
  }
});

// ─── task status ─────────────────────────────────────────────────────────────

test("task status: shows provisional task info by id", async () => {
  const { runTaskCommand } = await import("../src/task.js");
  const { dir, restore } = makeGithubRepoWithOutage("specreg-task-status-");
  const origDir = process.cwd();
  try {
    process.chdir(dir);
    await runTaskCommand({ subcommand: "open", args: [], title: "Status task", dir: ".tasks", allowLocalFallback: true });
    // status of a local id should not hit the network; should not throw
    await runTaskCommand({ subcommand: "status", args: ["0001-status-task.md"], dir: ".tasks" });
  } finally {
    process.chdir(origDir);
    restore();
    fs.rmSync(dir, { recursive: true });
  }
});

test("task status: throws for unknown id", async () => {
  const { runTaskCommand } = await import("../src/task.js");
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "specreg-task-status-"));
  const origDir = process.cwd();
  try {
    process.chdir(tmpDir);
    await assert.rejects(
      () => runTaskCommand({ subcommand: "status", args: ["9999.md"], dir: ".tasks" }),
      /Task not found/
    );
  } finally {
    process.chdir(origDir);
    fs.rmSync(tmpDir, { recursive: true });
  }
});
