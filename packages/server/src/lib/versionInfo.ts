import { execFile, execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const GIT_TIMEOUT_MS = 10000;

function git(args: string[], cwd: string): string | undefined {
  try {
    return execFileSync("git", args, { cwd, encoding: "utf8", timeout: GIT_TIMEOUT_MS, stdio: ["ignore", "pipe", "ignore"] }).trim() || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Absolute path to the git working tree the server is running from, regardless of
 * which package's directory is the process cwd (npm workspace scripts run with cwd
 * set to the workspace folder, not the repo root). Override with SPECREG_REPO_DIR for
 * process managers that launch the server from an unrelated cwd.
 */
export function repoRoot(): string | undefined {
  const override = process.env.SPECREG_REPO_DIR;
  if (override) return fs.existsSync(path.join(override, ".git")) ? override : undefined;
  return git(["rev-parse", "--show-toplevel"], process.cwd());
}

function packageVersion(root: string | undefined): string {
  const candidates = [
    root ? path.join(root, "package.json") : undefined,
    path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "package.json"),
  ].filter((p): p is string => Boolean(p));
  for (const candidate of candidates) {
    try {
      const pkg = JSON.parse(fs.readFileSync(candidate, "utf8")) as { version?: string };
      if (pkg.version) return pkg.version;
    } catch {
      // try the next candidate
    }
  }
  return "0.0.0";
}

/** Parses a git remote URL into "owner/repo" for the GitHub API. Returns undefined for non-GitHub remotes. */
export function githubSlugFromRemote(remote: string | undefined): string | undefined {
  if (!remote) return undefined;
  const ssh = remote.match(/^git@github\.com:(.+?)(?:\.git)?$/);
  if (ssh) return ssh[1];
  try {
    const url = new URL(remote);
    if (url.hostname !== "github.com") return undefined;
    return url.pathname.replace(/^\//, "").replace(/\.git$/, "");
  } catch {
    return undefined;
  }
}

export interface LocalVersionInfo {
  package_version: string;
  is_git_checkout: boolean;
  git_sha: string | null;
  git_sha_short: string | null;
  git_branch: string | null;
  is_dirty: boolean | null;
  repo_slug: string | null;
}

export function getLocalVersionInfo(): LocalVersionInfo {
  const root = repoRoot();
  const version = packageVersion(root);
  if (!root) {
    return {
      package_version: version,
      is_git_checkout: false,
      git_sha: null,
      git_sha_short: null,
      git_branch: null,
      is_dirty: null,
      repo_slug: null,
    };
  }
  const sha = git(["rev-parse", "HEAD"], root) ?? null;
  const branch = git(["rev-parse", "--abbrev-ref", "HEAD"], root) ?? null;
  const status = git(["status", "--porcelain"], root);
  const remote = git(["remote", "get-url", "origin"], root);
  return {
    package_version: version,
    is_git_checkout: true,
    git_sha: sha,
    git_sha_short: sha ? sha.slice(0, 7) : null,
    git_branch: branch && branch !== "HEAD" ? branch : null,
    is_dirty: status !== undefined,
    repo_slug: githubSlugFromRemote(remote) ?? process.env.SPECREG_GITHUB_REPO ?? null,
  };
}

export type GithubCompareStatus = "up_to_date" | "behind" | "ahead" | "diverged" | "unknown";

export interface GithubVersionCheck {
  repo: string | null;
  checked: boolean;
  status: GithubCompareStatus;
  /** Commits present on the branch that this checkout does not have. */
  behind_by: number | null;
  /** Local commits not present on the branch (e.g. unpushed work). */
  ahead_by: number | null;
  latest_sha: string | null;
  error: string | null;
  checked_at: string | null;
}

const UNCHECKED: GithubVersionCheck = {
  repo: null,
  checked: false,
  status: "unknown",
  behind_by: null,
  ahead_by: null,
  latest_sha: null,
  error: null,
  checked_at: null,
};

const CACHE_TTL_MS = 5 * 60 * 1000;
let cache: { key: string; result: GithubVersionCheck; fetchedAt: number } | undefined;

/** Drops the cached GitHub comparison so the next check hits the API immediately (call after a pull). */
export function invalidateGithubVersionCache(): void {
  cache = undefined;
}

/**
 * Compares the local commit against a GitHub branch via the compare API. GitHub's
 * compare response describes `head` relative to `base`: with base=localSha,
 * head=branch, a "ahead" status means the branch has commits we don't (we are
 * behind), and its `ahead_by` count is how many. A "behind" status means the
 * opposite: we have commits the branch doesn't (unpushed local work).
 */
export async function checkGithubVersion(local: LocalVersionInfo, githubToken?: string): Promise<GithubVersionCheck> {
  if (!local.repo_slug || !local.git_sha) {
    return { ...UNCHECKED, error: local.repo_slug ? "No local commit to compare" : "No GitHub remote configured" };
  }
  const branch = local.git_branch ?? "main";
  const key = `${local.repo_slug}:${local.git_sha}:${branch}`;
  const now = Date.now();
  if (cache && cache.key === key && now - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.result;
  }

  let result: GithubVersionCheck;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`https://api.github.com/repos/${local.repo_slug}/compare/${local.git_sha}...${branch}`, {
      headers: {
        accept: "application/vnd.github+json",
        ...(githubToken ? { authorization: `Bearer ${githubToken}` } : {}),
      },
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));
    if (res.status === 404) {
      result = {
        ...UNCHECKED,
        repo: local.repo_slug,
        checked: true,
        error: "Current commit was not found on GitHub (unpushed local commit, or a shallow/rewritten history).",
        checked_at: new Date().toISOString(),
      };
    } else if (!res.ok) {
      result = { ...UNCHECKED, repo: local.repo_slug, checked: false, error: `GitHub API returned ${res.status}` };
    } else {
      const body = (await res.json()) as { status: string; ahead_by: number; behind_by: number; commits: Array<{ sha: string }> };
      const behindBy = body.ahead_by; // commits the branch has that we don't
      const aheadBy = body.behind_by; // commits we have that the branch doesn't
      result = {
        repo: local.repo_slug,
        checked: true,
        status: behindBy > 0 && aheadBy > 0 ? "diverged" : behindBy > 0 ? "behind" : aheadBy > 0 ? "ahead" : "up_to_date",
        behind_by: behindBy,
        ahead_by: aheadBy,
        latest_sha: body.commits.length > 0 ? body.commits[body.commits.length - 1].sha : local.git_sha,
        error: null,
        checked_at: new Date().toISOString(),
      };
    }
  } catch (err) {
    result = { ...UNCHECKED, repo: local.repo_slug, checked: false, error: err instanceof Error ? err.message : "GitHub check failed" };
  }

  cache = { key, result, fetchedAt: now };
  return result;
}

export interface UpdateResult {
  ok: boolean;
  message: string;
  previous_sha: string | null;
  new_sha: string | null;
  updated: boolean;
  dependencies_installed: boolean;
  build_ran: boolean;
  output: string;
}

const COMMAND_TIMEOUT_MS = Number(process.env.SPECREG_UPDATE_TIMEOUT_MS) || 180000;

/** True when a `git diff --name-only` listing touches a manifest that could change installed dependencies. */
export function changedDependencyFiles(diffOutput: string): boolean {
  return /(^|\/)(package\.json|package-lock\.json)$/m.test(diffOutput);
}

function truncate(value: string, max = 4000): string {
  return value.length > max ? `${value.slice(0, max)}\n… (truncated)` : value;
}

async function run(command: string, args: string[], cwd: string): Promise<string> {
  const { stdout, stderr } = await execFileAsync(command, args, { cwd, timeout: COMMAND_TIMEOUT_MS, maxBuffer: 10 * 1024 * 1024 });
  return [stdout, stderr].filter(Boolean).join("\n");
}

/**
 * Pulls the latest commits for this checkout and rebuilds. Refuses on a dirty working
 * tree or a non-fast-forward pull rather than guessing at a merge. Does not restart the
 * running process — a manual restart (or process-manager restart) is still required to
 * pick up the new code, since Node cannot safely hot-swap its own already-loaded modules.
 */
export async function pullAndRebuild(): Promise<UpdateResult> {
  const root = repoRoot();
  if (!root) {
    throw new Error(
      "This server is not running from a git checkout (likely a Docker/packaged deployment). " +
        "Redeploy a new build instead of pulling in place."
    );
  }
  const status = git(["status", "--porcelain"], root);
  if (status !== undefined) {
    throw new Error(`Working tree has local modifications; resolve or stash them before updating:\n${truncate(status, 1000)}`);
  }
  const branch = git(["rev-parse", "--abbrev-ref", "HEAD"], root);
  if (!branch || branch === "HEAD") {
    throw new Error("Repository is in a detached HEAD state; check out a branch before updating.");
  }
  const previousSha = git(["rev-parse", "HEAD"], root) ?? null;

  let output = "";
  try {
    output += (await run("git", ["pull", "--ff-only", "origin", branch], root)) + "\n";
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(`git pull --ff-only failed (a non-fast-forward pull needs manual resolution):\n${truncate(detail)}`);
  }

  const newSha = git(["rev-parse", "HEAD"], root) ?? null;
  const updated = Boolean(previousSha && newSha && previousSha !== newSha);

  let dependenciesInstalled = false;
  if (updated && previousSha && newSha) {
    const changed = git(["diff", "--name-only", previousSha, newSha], root) ?? "";
    if (changedDependencyFiles(changed)) {
      output += (await run("npm", ["install"], root)) + "\n";
      dependenciesInstalled = true;
    }
  }

  let buildRan = false;
  if (updated) {
    output += (await run("npm", ["run", "build"], root)) + "\n";
    buildRan = true;
    invalidateGithubVersionCache();
  }

  return {
    ok: true,
    message: updated
      ? "Pulled and rebuilt. Restart the server process to run the updated code."
      : "Already up to date with origin; nothing to pull.",
    previous_sha: previousSha,
    new_sha: newSha,
    updated,
    dependencies_installed: dependenciesInstalled,
    build_ran: buildRan,
    output: truncate(output),
  };
}
