import fs from "node:fs";
import path from "node:path";

// ─── Types ────────────────────────────────────────────────────────────────────

export type TaskStatus = "open" | "in-progress" | "blocked" | "done" | "abandoned";
export type TaskSystem = "github" | "local";

export interface TaskFrontmatter {
  id: string;
  title: string;
  status: TaskStatus;
  created: string;
  updated: string;
  spec_refs: string[];
  branch: string | null;
  pr: string | null;
  blocked_by: string | null;
  github_fallback: boolean;
}

export interface TaskFile {
  filename: string;         // e.g. "0003-add-oauth-middleware.md"
  frontmatter: TaskFrontmatter;
  body: string;
}

export interface GitHubIssue {
  number: number;
  title: string;
  html_url: string;
  state: "open" | "closed";
  body: string | null;
  labels: Array<{ name: string }>;
}

export interface TaskOptions {
  server?: string;
  token?: string;
  subcommand: string | undefined;
  args: string[];
  dir?: string;           // local .tasks/ directory (default: .tasks)
  status?: string;        // filter flag
  json?: boolean;
  title?: string;
  body?: string;
  specRefs?: string;
  githubToken?: string;
  allowLocalFallback?: boolean;   // permit emergency .tasks/ fallback on GitHub API outage
}

// ─── GitHub detection ─────────────────────────────────────────────────────────

export function detectTaskSystem(root: string = process.cwd()): {
  system: TaskSystem;
  owner?: string;
  repo?: string;
} {
  const gitConfig = path.join(root, ".git", "config");
  if (!fs.existsSync(gitConfig)) return { system: "local" };
  const config = fs.readFileSync(gitConfig, "utf8");
  const match = config.match(/url\s*=\s*.*github\.com[/:]([^/]+)\/([^\s\.]+)/);
  if (!match) return { system: "local" };
  const owner = match[1];
  const repo = match[2].replace(/\.git$/, "");
  return { system: "github", owner, repo };
}

function resolveGitHubToken(explicit?: string): string | undefined {
  return explicit ?? process.env.SPECREG_GITHUB_TOKEN ?? process.env.GITHUB_TOKEN;
}

// ─── GitHub Issues helpers ────────────────────────────────────────────────────

async function ghFetch<T>(
  url: string,
  method: "GET" | "POST" | "PATCH",
  body: unknown | undefined,
  token: string
): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`GitHub API ${method} ${url} failed ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export async function listGitHubIssues(
  owner: string,
  repo: string,
  token: string,
  state: "open" | "closed" | "all" = "open"
): Promise<GitHubIssue[]> {
  const url = `https://api.github.com/repos/${owner}/${repo}/issues?labels=specreg-task&state=${state}&per_page=100`;
  return ghFetch<GitHubIssue[]>(url, "GET", undefined, token);
}

export async function createGitHubIssue(
  owner: string,
  repo: string,
  token: string,
  title: string,
  body: string
): Promise<GitHubIssue> {
  const url = `https://api.github.com/repos/${owner}/${repo}/issues`;
  return ghFetch<GitHubIssue>(url, "POST", { title, body, labels: ["specreg-task"] }, token);
}

export async function closeGitHubIssue(
  owner: string,
  repo: string,
  token: string,
  number: number
): Promise<GitHubIssue> {
  const url = `https://api.github.com/repos/${owner}/${repo}/issues/${number}`;
  return ghFetch<GitHubIssue>(url, "PATCH", { state: "closed" }, token);
}

export async function commentGitHubIssue(
  owner: string,
  repo: string,
  token: string,
  number: number,
  comment: string
): Promise<void> {
  const url = `https://api.github.com/repos/${owner}/${repo}/issues/${number}/comments`;
  await ghFetch(url, "POST", { body: comment }, token);
}

// ─── Local .tasks/ helpers ────────────────────────────────────────────────────

function tasksDir(dir: string = ".tasks"): string {
  return path.resolve(process.cwd(), dir);
}

function ensureTasksDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

function nextTaskId(dir: string): string {
  if (!fs.existsSync(dir)) return "0001";
  const files = fs.readdirSync(dir).filter((f) => /^\d{4}-.*\.md$/.test(f));
  if (!files.length) return "0001";
  const maxId = Math.max(...files.map((f) => parseInt(f.slice(0, 4), 10)));
  return String(maxId + 1).padStart(4, "0");
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function serializeFrontmatter(fm: TaskFrontmatter): string {
  const specRefsYaml = fm.spec_refs.length
    ? fm.spec_refs.map((s) => `  - ${s}`).join("\n")
    : "  []";
  return [
    "---",
    `id: "${fm.id}"`,
    `title: "${fm.title.replace(/"/g, '\\"')}"`,
    `status: ${fm.status}`,
    `created: ${fm.created}`,
    `updated: ${fm.updated}`,
    `spec_refs:`,
    specRefsYaml,
    `branch: ${fm.branch ?? "null"}`,
    `pr: ${fm.pr ?? "null"}`,
    `blocked_by: ${fm.blocked_by ?? "null"}`,
    `github_fallback: ${fm.github_fallback}`,
    "---",
  ].join("\n");
}

function parseFrontmatter(content: string): { frontmatter: TaskFrontmatter; body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) throw new Error("Task file missing YAML front-matter block");
  const raw = match[1];
  const body = match[2];
  const get = (key: string, def: string = ""): string => {
    const m = raw.match(new RegExp(`^${key}:\s*(.+)$`, "m"));
    return m ? m[1].trim().replace(/^"|"$/g, "") : def;
  };
  const getArray = (key: string): string[] => {
    const block = raw.match(new RegExp(`^${key}:\n((?:\s+- .+\n?)+)`, "m"));
    if (!block) return [];
    return block[1]
      .split("\n")
      .map((l) => l.replace(/^\s+- /, "").trim())
      .filter(Boolean);
  };
  return {
    frontmatter: {
      id: get("id"),
      title: get("title"),
      status: get("status", "open") as TaskStatus,
      created: get("created"),
      updated: get("updated"),
      spec_refs: getArray("spec_refs"),
      branch: get("branch") === "null" ? null : get("branch") || null,
      pr: get("pr") === "null" ? null : get("pr") || null,
      blocked_by: get("blocked_by") === "null" ? null : get("blocked_by") || null,
      github_fallback: get("github_fallback") === "true",
    },
    body,
  };
}

function readTaskFile(filePath: string): TaskFile {
  const content = fs.readFileSync(filePath, "utf8");
  const { frontmatter, body } = parseFrontmatter(content);
  return { filename: path.basename(filePath), frontmatter, body };
}

function writeTaskFile(dir: string, task: TaskFile): string {
  const filePath = path.join(dir, task.filename);
  const content = serializeFrontmatter(task.frontmatter) + "\n" + task.body;
  fs.writeFileSync(filePath, content, "utf8");
  return filePath;
}

function listTaskFiles(dir: string): TaskFile[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => /^\d{4}-.*\.md$/.test(f))
    .sort()
    .map((f) => readTaskFile(path.join(dir, f)));
}

function buildTaskBody(title: string, specRefs: string[], extraBody?: string): string {
  const specSection = specRefs.length
    ? specRefs.map((s) => `- ${s}`).join("\n")
    : "_None specified_";
  return `
## Objective

${extraBody ?? "_Describe what must be true when this task is done and why it matters._"}

## Acceptance Criteria

- [ ] _Add criteria_

## Affected Systems

_List repositories, subsystems, APIs, schemas, or config areas in scope._

## Spec References

${specSection}

## Assumptions and Open Questions

_None yet._

## Notes

_Progress notes appended here._
`;
}

// ─── Subcommands ──────────────────────────────────────────────────────────────

async function runTaskOpen(opts: TaskOptions): Promise<void> {
  const title = opts.title ?? opts.args[0];
  if (!title) throw new Error("Usage: specreg task open --title <title> [--spec-refs a,b]");
  const specRefs = opts.specRefs ? opts.specRefs.split(",").map((s) => s.trim()) : [];
  const dir = tasksDir(opts.dir);
  const detection = detectTaskSystem();
  const ghToken = resolveGitHubToken(opts.githubToken);

  // Policy (TASK_WORKFLOW.md): GitHub Issues are the mandatory system of record.
  // The local .tasks/ path is only a temporary fallback for a genuine GitHub API outage
  // while a valid token is present. Missing token or non-GitHub repo must halt.
  if (detection.system !== "github") {
    throw new Error(
      "GitHub Issues are the mandatory task system of record, but no github.com origin " +
        "remote was found. Halt and escalate: this repository cannot be governed by " +
        "TASK_WORKFLOW.md until it is GitHub-backed."
    );
  }
  if (!ghToken) {
    throw new Error(
      "GitHub Issues are required, but no GitHub token is configured. Set " +
        "SPECREG_GITHUB_TOKEN or GITHUB_TOKEN (or pass --github-token). A missing token is " +
        "an error, not a reason to write a local .tasks/ file."
    );
  }

  try {
    const body = buildTaskBody(title, specRefs, opts.body);
    const issue = await createGitHubIssue(detection.owner!, detection.repo!, ghToken, title, body);
    const slug = slugify(title);
    const branch = `task/${issue.number}-${slug}`;
    console.log(`\nOpened GitHub Issue #${issue.number}: ${issue.html_url}`);
    console.log(`Branch: ${branch}`);
    console.log(`Task-Ref: #${issue.number}`);
    return;
  } catch (err) {
    // Genuine API outage path. Only fall back when explicitly permitted.
    const reason = err instanceof Error ? err.message : String(err);
    if (!opts.allowLocalFallback) {
      throw new Error(
        `GitHub Issues API is unreachable (${reason}). GitHub Issues are mandatory. ` +
          "Re-run with --allow-local-fallback to open a provisional local .tasks/ file for " +
          "this outage; you must migrate it to a GitHub Issue before opening a PR."
      );
    }
    console.warn(
      `Warning: GitHub Issues API unreachable (${reason}). Opening a PROVISIONAL local ` +
        ".tasks/ file. Migrate it to a GitHub Issue before opening a PR (TASK_WORKFLOW.md)."
    );
    ensureTasksDir(dir);
    const id = nextTaskId(dir);
    const slug = slugify(title);
    const filename = `${id}-${slug}.md`;
    const branch = `task/${id}-${slug}`;
    const outageNote = `\n\n_Emergency local fallback: GitHub Issues API unreachable at ${new Date().toISOString()} (${reason}). Migrate to a GitHub Issue before opening a PR._`;
    const fm: TaskFrontmatter = {
      id,
      title,
      status: "open",
      created: today(),
      updated: today(),
      spec_refs: specRefs,
      branch,
      pr: null,
      blocked_by: null,
      github_fallback: true,
    };
    const task: TaskFile = {
      filename,
      frontmatter: fm,
      body: buildTaskBody(title, specRefs, opts.body) + outageNote,
    };
    const written = writeTaskFile(dir, task);
    console.log(`\nOpened PROVISIONAL local task: ${written}`);
    console.log(`Branch: ${branch}`);
    console.log(`Task-Ref: .tasks/${filename} (provisional — migrate to a GitHub Issue)`);
  }
}

async function runTaskList(opts: TaskOptions): Promise<void> {
  const dir = tasksDir(opts.dir);
  const detection = detectTaskSystem();
  const ghToken = resolveGitHubToken(opts.githubToken);
  const statusFilter = opts.status as TaskStatus | undefined;

  if (detection.system === "github" && ghToken) {
    const state = statusFilter === "done" ? "closed" : statusFilter === "abandoned" ? "closed" : "open";
    const issues = await listGitHubIssues(detection.owner!, detection.repo!, ghToken, state);
    if (opts.json) {
      console.log(JSON.stringify(issues, null, 2));
    } else {
      if (!issues.length) {
        console.log("No open specreg-task issues found.");
        return;
      }
      for (const issue of issues) {
        console.log(`  #${issue.number}  ${issue.state.padEnd(7)}  ${issue.title}`);
        console.log(`          ${issue.html_url}`);
      }
    }
  } else {
    const tasks = listTaskFiles(dir).filter((t) =>
      statusFilter ? t.frontmatter.status === statusFilter : true
    );
    if (opts.json) {
      console.log(JSON.stringify(tasks, null, 2));
    } else {
      if (!tasks.length) {
        console.log("No tasks found" + (statusFilter ? ` with status '${statusFilter}'` : "") + ".");
        return;
      }
      for (const t of tasks) {
        const fm = t.frontmatter;
        console.log(`  ${fm.id}  ${fm.status.padEnd(12)}  ${fm.title}`);
        console.log(`          .tasks/${t.filename}`);
      }
    }
  }
}

async function runTaskStatus(opts: TaskOptions): Promise<void> {
  const ref = opts.args[0];
  if (!ref) throw new Error("Usage: specreg task status <issue-number|task-id|filename>");
  const dir = tasksDir(opts.dir);
  const detection = detectTaskSystem();
  const ghToken = resolveGitHubToken(opts.githubToken);

  if (/^\d+$/.test(ref) && detection.system === "github" && ghToken) {
    const issue = await ghFetch<GitHubIssue>(
      `https://api.github.com/repos/${detection.owner}/${detection.repo}/issues/${ref}`,
      "GET",
      undefined,
      ghToken
    );
    console.log(`#${issue.number}  ${issue.state}  ${issue.title}`);
    console.log(issue.html_url);
  } else {
    const tasks = listTaskFiles(dir);
    const task = tasks.find(
      (t) => t.frontmatter.id === ref.padStart(4, "0") || t.filename === ref || t.filename.startsWith(ref + "-")
    );
    if (!task) throw new Error(`Task not found: ${ref}`);
    const fm = task.frontmatter;
    console.log(`${fm.id}  ${fm.status}  ${fm.title}`);
    console.log(`Branch: ${fm.branch ?? "(none)"}`);
    console.log(`PR: ${fm.pr ?? "(none)"}`);
    console.log(`Updated: ${fm.updated}`);
    if (fm.blocked_by) console.log(`Blocked by: ${fm.blocked_by}`);
  }
}

async function runTaskUpdate(opts: TaskOptions): Promise<void> {
  const ref = opts.args[0];
  if (!ref || !opts.status) {
    throw new Error("Usage: specreg task update <task-id|filename> --status <status>");
  }
  const dir = tasksDir(opts.dir);
  const tasks = listTaskFiles(dir);
  const task = tasks.find(
    (t) => t.frontmatter.id === ref.padStart(4, "0") || t.filename === ref || t.filename.startsWith(ref + "-")
  );
  if (!task) throw new Error(`Task not found: ${ref}`);
  task.frontmatter.status = opts.status as TaskStatus;
  task.frontmatter.updated = today();
  writeTaskFile(dir, task);
  console.log(`Updated ${task.filename}: status → ${opts.status}`);
}

async function runTaskClose(opts: TaskOptions): Promise<void> {
  const ref = opts.args[0];
  if (!ref) throw new Error("Usage: specreg task close <issue-number|task-id>");
  const dir = tasksDir(opts.dir);
  const detection = detectTaskSystem();
  const ghToken = resolveGitHubToken(opts.githubToken);

  if (/^\d+$/.test(ref) && detection.system === "github" && ghToken) {
    const issue = await closeGitHubIssue(detection.owner!, detection.repo!, ghToken, Number(ref));
    console.log(`Closed GitHub Issue #${issue.number}: ${issue.html_url}`);
  } else {
    const tasks = listTaskFiles(dir);
    const task = tasks.find(
      (t) => t.frontmatter.id === ref.padStart(4, "0") || t.filename === ref || t.filename.startsWith(ref + "-")
    );
    if (!task) throw new Error(`Task not found: ${ref}`);
    task.frontmatter.status = "done";
    task.frontmatter.updated = today();
    writeTaskFile(dir, task);
    console.log(`Closed task: ${task.filename}`);
  }
}

// ─── Entry point ──────────────────────────────────────────────────────────────

export async function runTaskCommand(opts: TaskOptions): Promise<void> {
  const sub = opts.subcommand;
  if (!sub || sub === "list") return runTaskList(opts);
  if (sub === "open") return runTaskOpen(opts);
  if (sub === "status") return runTaskStatus(opts);
  if (sub === "update") return runTaskUpdate(opts);
  if (sub === "close") return runTaskClose(opts);
  throw new Error(
    `Unknown task subcommand: ${sub}\nUsage: specreg task open|list|status|update|close`
  );
}
