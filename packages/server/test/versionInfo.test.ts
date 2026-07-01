import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  changedDependencyFiles,
  checkGithubVersion,
  getLocalVersionInfo,
  githubSlugFromRemote,
  pullAndRebuild,
  type LocalVersionInfo,
} from "../src/lib/versionInfo.js";
import { git, makeGitFixture, pushNewCommit } from "./gitFixture.js";

const cleanupDirs: string[] = [];
const makeFixture = () => makeGitFixture(cleanupDirs);
afterEach(() => {
  delete process.env.SPECREG_REPO_DIR;
  vi.unstubAllGlobals();
  for (const dir of cleanupDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function useRepoDir(dir: string): void {
  process.env.SPECREG_REPO_DIR = dir;
}

describe("githubSlugFromRemote", () => {
  it("parses an SSH GitHub remote", () => {
    expect(githubSlugFromRemote("git@github.com:joeldg/SpecRegistry.git")).toBe("joeldg/SpecRegistry");
  });
  it("parses an HTTPS GitHub remote", () => {
    expect(githubSlugFromRemote("https://github.com/joeldg/SpecRegistry.git")).toBe("joeldg/SpecRegistry");
  });
  it("returns undefined for a non-GitHub remote", () => {
    expect(githubSlugFromRemote("https://gitlab.com/joeldg/SpecRegistry.git")).toBeUndefined();
  });
  it("returns undefined when there is no remote", () => {
    expect(githubSlugFromRemote(undefined)).toBeUndefined();
  });
});

describe("changedDependencyFiles", () => {
  it("detects a top-level package.json in the diff", () => {
    expect(changedDependencyFiles("README.md\npackage.json\n")).toBe(true);
  });
  it("detects a workspace package-lock.json", () => {
    expect(changedDependencyFiles("packages/server/src/index.ts\npackage-lock.json\n")).toBe(true);
  });
  it("is false when no manifest changed", () => {
    expect(changedDependencyFiles("README.md\nsrc/index.ts\n")).toBe(false);
  });
});

describe("getLocalVersionInfo", () => {
  it("reports is_git_checkout: false when SPECREG_REPO_DIR is not a git repo", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specreg-version-noise-"));
    cleanupDirs.push(dir);
    process.env.SPECREG_REPO_DIR = dir;
    const info = getLocalVersionInfo();
    expect(info.is_git_checkout).toBe(false);
    expect(info.git_sha).toBeNull();
  });

  it("reports sha, branch, and repo slug for a real checkout", () => {
    const { serverCheckout } = makeFixture();
    useRepoDir(serverCheckout);
    const info = getLocalVersionInfo();
    expect(info.is_git_checkout).toBe(true);
    expect(info.git_sha).toMatch(/^[0-9a-f]{40}$/);
    expect(info.is_dirty).toBe(false);
    expect(info.repo_slug).toBeNull(); // fixture remote is a local path, not github.com
  });

  it("detects a dirty working tree", () => {
    const { serverCheckout } = makeFixture();
    useRepoDir(serverCheckout);
    fs.writeFileSync(path.join(serverCheckout, "untracked.txt"), "oops");
    expect(getLocalVersionInfo().is_dirty).toBe(true);
  });
});

describe("checkGithubVersion", () => {
  const local: LocalVersionInfo = {
    package_version: "1.0.0",
    is_git_checkout: true,
    git_sha: "a".repeat(40),
    git_sha_short: "aaaaaaa",
    git_branch: "main",
    is_dirty: false,
    repo_slug: "joeldg/SpecRegistry",
  };

  it("reports behind when GitHub is ahead of the local commit", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ status: "ahead", ahead_by: 3, behind_by: 0, commits: [{ sha: "b".repeat(40) }] }), { status: 200 })
      )
    );
    const result = await checkGithubVersion(local);
    expect(result.status).toBe("behind");
    expect(result.behind_by).toBe(3);
    expect(result.latest_sha).toBe("b".repeat(40));
  });

  it("reports up_to_date when identical", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: "identical", ahead_by: 0, behind_by: 0, commits: [] }), { status: 200 }))
    );
    const result = await checkGithubVersion({ ...local, git_sha: "c".repeat(40) });
    expect(result.status).toBe("up_to_date");
  });

  it("reports unknown with an error when the commit is not found on GitHub", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("not found", { status: 404 })));
    const result = await checkGithubVersion({ ...local, git_sha: "d".repeat(40) });
    expect(result.checked).toBe(true);
    expect(result.status).toBe("unknown");
    expect(result.error).toContain("not found");
  });

  it("skips the network call entirely when there is no GitHub remote", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const result = await checkGithubVersion({ ...local, repo_slug: null });
    expect(result.checked).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("pullAndRebuild", () => {
  it("refuses when not running from a git checkout", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specreg-version-noise-"));
    cleanupDirs.push(dir);
    process.env.SPECREG_REPO_DIR = dir;
    await expect(pullAndRebuild()).rejects.toThrow(/not running from a git checkout/);
  });

  it("refuses on a dirty working tree", async () => {
    const { serverCheckout } = makeFixture();
    useRepoDir(serverCheckout);
    fs.writeFileSync(path.join(serverCheckout, "dirty.txt"), "uncommitted");
    await expect(pullAndRebuild()).rejects.toThrow(/local modifications/);
  });

  it("refuses in a detached HEAD state", async () => {
    const { serverCheckout } = makeFixture();
    const sha = git(["rev-parse", "HEAD"], serverCheckout);
    git(["checkout", sha], serverCheckout);
    useRepoDir(serverCheckout);
    await expect(pullAndRebuild()).rejects.toThrow(/detached HEAD/);
  });

  it("reports already up to date and does not rebuild when there is nothing to pull", async () => {
    const { serverCheckout } = makeFixture();
    useRepoDir(serverCheckout);
    const result = await pullAndRebuild();
    expect(result.updated).toBe(false);
    expect(result.build_ran).toBe(false);
    expect(result.message).toMatch(/already up to date/i);
  });

  it("pulls a new commit and rebuilds, without touching dependencies", async () => {
    const { serverCheckout, contributorCheckout } = makeFixture();
    pushNewCommit(contributorCheckout, "NEW_FILE.md");
    useRepoDir(serverCheckout);

    const result = await pullAndRebuild();
    expect(result.updated).toBe(true);
    expect(result.build_ran).toBe(true);
    expect(result.dependencies_installed).toBe(false);
    expect(result.previous_sha).not.toBe(result.new_sha);
    expect(fs.existsSync(path.join(serverCheckout, "NEW_FILE.md"))).toBe(true);
  }, 20000);

  it("installs dependencies when package.json changed in the pulled commits", async () => {
    const { serverCheckout, contributorCheckout } = makeFixture();
    fs.writeFileSync(
      path.join(contributorCheckout, "package.json"),
      JSON.stringify({ name: "fixture", version: "1.0.1", scripts: { build: "node -e \"process.exit(0)\"" } })
    );
    git(["add", "."], contributorCheckout);
    git(["commit", "-m", "bump version"], contributorCheckout);
    git(["push", "origin", "HEAD"], contributorCheckout);
    useRepoDir(serverCheckout);

    const result = await pullAndRebuild();
    expect(result.updated).toBe(true);
    expect(result.dependencies_installed).toBe(true);
  }, 30000);
});
