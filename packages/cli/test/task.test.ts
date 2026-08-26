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

function parseFrontmatterStatus(filePath: string): string {
  const content = fs.readFileSync(filePath, "utf8");
  const m = content.match(/^status:\s*(\S+)$/m);
  return m ? m[1] : "";
}

function parseFrontmatterField(filePath: string, field: string): string {
  const content = fs.readFileSync(filePath, "utf8");
  const m = content.match(new RegExp(`^${field}:\s*(.+)$`, "m"));
  return m ? m[1].trim().replace(/^"|"$/g, "") : "";
}

function parseFrontmatterArray(filePath: string, field: string): string[] {
  const content = fs.readFileSync(filePath, "utf8");
  const block = content.match(new RegExp(`^${field}:\\n((?:\\s+- .+\\n?)+)`, "m"));
  if (!block) return [];
  return block[1]
    .split("\n")
    .map((l: string) => l.replace(/^\s+- /, "").trim())
    .filter(Boolean);
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

// ─── task open (local) ────────────────────────────────────────────────────────

test("task open: creates first task file with id 0001", async () => {
  const { runTaskCommand } = await import("../src/task.js");
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "specreg-task-open-"));
  const origDir = process.cwd();
  try {
    process.chdir(tmpDir);
    await runTaskCommand({ subcommand: "open", args: [], title: "Add rate limiting", dir: ".tasks" });
    const tasksPath = path.join(tmpDir, ".tasks");
    const files = fs.readdirSync(tasksPath);
    assert.equal(files.length, 1);
    assert.equal(files[0], "0001-add-rate-limiting.md");
    const filePath = path.join(tasksPath, files[0]);
    assert.equal(parseFrontmatterField(filePath, "id"), "0001");
    assert.equal(parseFrontmatterField(filePath, "title"), "Add rate limiting");
    assert.equal(parseFrontmatterStatus(filePath), "open");
    assert.equal(parseFrontmatterField(filePath, "branch"), "task/0001-add-rate-limiting");
  } finally {
    process.chdir(origDir);
    fs.rmSync(tmpDir, { recursive: true });
  }
});

test("task open: increments id for second task", async () => {
  const { runTaskCommand } = await import("../src/task.js");
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "specreg-task-open-"));
  const origDir = process.cwd();
  try {
    process.chdir(tmpDir);
    await runTaskCommand({ subcommand: "open", args: [], title: "First task", dir: ".tasks" });
    await runTaskCommand({ subcommand: "open", args: [], title: "Second task", dir: ".tasks" });
    const files = fs.readdirSync(path.join(tmpDir, ".tasks")).sort();
    assert.equal(files.length, 2);
    assert.ok(files[0].startsWith("0001-"), `Expected 0001- prefix, got: ${files[0]}`);
    assert.ok(files[1].startsWith("0002-"), `Expected 0002- prefix, got: ${files[1]}`);
  } finally {
    process.chdir(origDir);
    fs.rmSync(tmpDir, { recursive: true });
  }
});

test("task open: records spec_refs in front-matter", async () => {
  const { runTaskCommand } = await import("../src/task.js");
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "specreg-task-open-"));
  const origDir = process.cwd();
  try {
    process.chdir(tmpDir);
    await runTaskCommand({
      subcommand: "open",
      args: [],
      title: "Auth work",
      dir: ".tasks",
      specRefs: "GLOBAL_SECURITY.md#auth,API.md#endpoints",
    });
    const files = fs.readdirSync(path.join(tmpDir, ".tasks"));
    const filePath = path.join(tmpDir, ".tasks", files[0]);
    const content = fs.readFileSync(filePath, "utf8");
    assert.ok(content.includes("GLOBAL_SECURITY.md#auth"), "Missing GLOBAL_SECURITY.md#auth");
    assert.ok(content.includes("API.md#endpoints"), "Missing API.md#endpoints");
  } finally {
    process.chdir(origDir);
    fs.rmSync(tmpDir, { recursive: true });
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

test("task list: shows tasks after opening", async () => {
  const { runTaskCommand } = await import("../src/task.js");
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "specreg-task-list-"));
  const origDir = process.cwd();
  try {
    process.chdir(tmpDir);
    await runTaskCommand({ subcommand: "open", args: [], title: "Alpha", dir: ".tasks" });
    await runTaskCommand({ subcommand: "open", args: [], title: "Beta", dir: ".tasks" });
    await runTaskCommand({ subcommand: "list", args: [], dir: ".tasks" });
    const files = fs.readdirSync(path.join(tmpDir, ".tasks")).sort();
    assert.equal(files.length, 2);
  } finally {
    process.chdir(origDir);
    fs.rmSync(tmpDir, { recursive: true });
  }
});

// ─── task update ─────────────────────────────────────────────────────────────

test("task update: sets status to in-progress", async () => {
  const { runTaskCommand } = await import("../src/task.js");
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "specreg-task-upd-"));
  const origDir = process.cwd();
  try {
    process.chdir(tmpDir);
    await runTaskCommand({ subcommand: "open", args: [], title: "Update me", dir: ".tasks" });
    await runTaskCommand({ subcommand: "update", args: ["0001"], status: "in-progress", dir: ".tasks" });
    const files = fs.readdirSync(path.join(tmpDir, ".tasks"));
    const filePath = path.join(tmpDir, ".tasks", files[0]);
    assert.equal(parseFrontmatterStatus(filePath), "in-progress");
  } finally {
    process.chdir(origDir);
    fs.rmSync(tmpDir, { recursive: true });
  }
});

// ─── task close ──────────────────────────────────────────────────────────────

test("task close: marks task done", async () => {
  const { runTaskCommand } = await import("../src/task.js");
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "specreg-task-close-"));
  const origDir = process.cwd();
  try {
    process.chdir(tmpDir);
    await runTaskCommand({ subcommand: "open", args: [], title: "Close me", dir: ".tasks" });
    await runTaskCommand({ subcommand: "close", args: ["0001"], dir: ".tasks" });
    const files = fs.readdirSync(path.join(tmpDir, ".tasks"));
    const filePath = path.join(tmpDir, ".tasks", files[0]);
    assert.equal(parseFrontmatterStatus(filePath), "done");
  } finally {
    process.chdir(origDir);
    fs.rmSync(tmpDir, { recursive: true });
  }
});

// ─── task status ─────────────────────────────────────────────────────────────

test("task status: shows task info by id", async () => {
  const { runTaskCommand } = await import("../src/task.js");
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "specreg-task-status-"));
  const origDir = process.cwd();
  try {
    process.chdir(tmpDir);
    await runTaskCommand({ subcommand: "open", args: [], title: "Status task", dir: ".tasks" });
    // Should not throw
    await runTaskCommand({ subcommand: "status", args: ["0001"], dir: ".tasks" });
  } finally {
    process.chdir(origDir);
    fs.rmSync(tmpDir, { recursive: true });
  }
});

test("task status: throws for unknown id", async () => {
  const { runTaskCommand } = await import("../src/task.js");
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "specreg-task-status-"));
  const origDir = process.cwd();
  try {
    process.chdir(tmpDir);
    await assert.rejects(
      () => runTaskCommand({ subcommand: "status", args: ["9999"], dir: ".tasks" }),
      /Task not found/
    );
  } finally {
    process.chdir(origDir);
    fs.rmSync(tmpDir, { recursive: true });
  }
});
