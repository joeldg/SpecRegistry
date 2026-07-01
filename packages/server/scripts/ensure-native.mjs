// Self-healing guard for the better-sqlite3 native module.
//
// better-sqlite3 ships a compiled .node binary tied to one Node ABI
// (NODE_MODULE_VERSION). Switching Node versions (e.g. a repo pinned to Node 24
// run from a Node 22 shell, or CI on a different runtime) makes it fail to load
// with ERR_DLOPEN_FAILED. This runs before dev/start/test and, only when the
// module can't load, rebuilds it for the *current* Node — so the version in use
// no longer matters. A healthy install is a fast no-op.

import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";

function findRoot(start) {
  let dir = start;
  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(path.join(dir, "node_modules", "better-sqlite3"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return start;
}

const root = findRoot(path.dirname(fileURLToPath(import.meta.url)));

// Probe in a fresh process so a failed dlopen can't poison this one.
function loads() {
  try {
    execFileSync(process.execPath, ["-e", "new (require('better-sqlite3'))(':memory:').close()"], {
      cwd: root,
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}

if (loads()) process.exit(0);

console.error(
  `[specregistry] better-sqlite3 native module does not match Node ${process.version} — rebuilding (one-time)...`
);
try {
  execFileSync("npm", ["rebuild", "better-sqlite3"], { cwd: root, stdio: "inherit" });
} catch {
  console.error("[specregistry] Automatic rebuild failed. Run `npm rebuild better-sqlite3` and retry.");
  process.exit(1);
}
if (!loads()) {
  console.error("[specregistry] better-sqlite3 still fails to load after rebuild.");
  process.exit(1);
}
console.error(`[specregistry] better-sqlite3 rebuilt for Node ${process.version}.`);
