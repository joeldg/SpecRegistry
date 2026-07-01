import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export function git(args: string[], cwd: string): string {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
}

function initCheckout(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
  git(["init", "--initial-branch=main"], dir);
  git(["config", "user.email", "test@example.com"], dir);
  git(["config", "user.name", "Test"], dir);
  git(["config", "advice.detachedHead", "false"], dir);
}

// A trivial build script with no dependencies to install and no network calls, so
// pullAndRebuild's real `npm run build` step stays fast and offline in tests.
const FIXTURE_PACKAGE_JSON = JSON.stringify({ name: "fixture", version: "1.0.0", scripts: { build: "node -e \"process.exit(0)\"" } });

export interface GitFixture {
  root: string;
  remote: string;
  serverCheckout: string;
  contributorCheckout: string;
  branch: string;
}

/** A bare "GitHub" remote, a server checkout cloned from it, and a second contributor
 * checkout used to push new commits the server checkout hasn't pulled yet. */
export function makeGitFixture(cleanupDirs: string[]): GitFixture {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "specreg-version-"));
  cleanupDirs.push(root);
  const remote = path.join(root, "remote.git");
  execFileSync("git", ["init", "--bare", "--initial-branch=main", remote], { stdio: "ignore" });

  const seed = path.join(root, "seed");
  initCheckout(seed);
  fs.writeFileSync(path.join(seed, "package.json"), FIXTURE_PACKAGE_JSON);
  git(["add", "."], seed);
  git(["commit", "-m", "initial"], seed);
  git(["remote", "add", "origin", remote], seed);
  git(["push", "origin", "HEAD"], seed);
  const branch = git(["rev-parse", "--abbrev-ref", "HEAD"], seed);

  const serverCheckout = path.join(root, "server");
  git(["clone", remote, serverCheckout], root);
  git(["config", "user.email", "test@example.com"], serverCheckout);
  git(["config", "user.name", "Test"], serverCheckout);
  git(["config", "advice.detachedHead", "false"], serverCheckout);

  const contributorCheckout = path.join(root, "contributor");
  git(["clone", remote, contributorCheckout], root);
  git(["config", "user.email", "contributor@example.com"], contributorCheckout);
  git(["config", "user.name", "Contributor"], contributorCheckout);

  return { root, remote, serverCheckout, contributorCheckout, branch };
}

export function pushNewCommit(contributorCheckout: string, filename: string): void {
  fs.writeFileSync(path.join(contributorCheckout, filename), "new content\n");
  git(["add", "."], contributorCheckout);
  git(["commit", "-m", `add ${filename}`], contributorCheckout);
  git(["push", "origin", "HEAD"], contributorCheckout);
}
