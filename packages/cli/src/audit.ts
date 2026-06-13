import fs from "node:fs";
import path from "node:path";
import { fetchJson, selectProjectType } from "./registry.js";
import { scanDirectory } from "./scan.js";

export interface AuditOptions {
  server: string;
  type?: string;
  dir: string;
  /** exit 1 when findings exist (CI gate) */
  ci?: boolean;
}

interface AuditFinding {
  severity: "high" | "medium" | "low";
  spec: string;
  section: string;
  file: string;
  description: string;
  recommendation: string;
}

const INTERESTING = [
  "package.json", "pyproject.toml", "go.mod", "Cargo.toml", "pom.xml", "CMakeLists.txt",
  "dockerfile", "docker-compose.yml", ".github/workflows",
];
const CODE_EXT = /\.(ts|tsx|js|jsx|py|go|rs|c|h|cpp|java|kt|rb|cs|sql|sh|tf|yaml|yml|toml|json)$/i;
const MAX_FILES = 14;
const MAX_CHARS_PER_FILE = 4000;

/** Pick a representative sample: manifests/configs first, then largest source files. */
function collectFiles(root: string): Array<{ path: string; content: string }> {
  const picked: string[] = [];
  const candidates: Array<{ rel: string; size: number }> = [];

  function walk(dir: string, depth: number): void {
    if (depth > 4) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith(".") || ["node_modules", "dist", "build", "specs", "__pycache__", "venv"].includes(entry.name)) continue;
      const full = path.join(dir, entry.name);
      const rel = path.relative(root, full);
      if (entry.isDirectory()) {
        walk(full, depth + 1);
      } else if (INTERESTING.some((n) => rel.toLowerCase().includes(n))) {
        picked.push(rel);
      } else if (CODE_EXT.test(entry.name)) {
        try {
          candidates.push({ rel, size: fs.statSync(full).size });
        } catch {
          // unreadable file — skip
        }
      }
    }
  }
  walk(root, 0);

  candidates.sort((a, b) => b.size - a.size);
  const selected = [...new Set([...picked, ...candidates.map((c) => c.rel)])].slice(0, MAX_FILES);
  return selected.flatMap((rel) => {
    try {
      const content = fs.readFileSync(path.join(root, rel), "utf8").slice(0, MAX_CHARS_PER_FILE);
      return [{ path: rel, content }];
    } catch {
      return [];
    }
  });
}

export async function runAudit(opts: AuditOptions): Promise<void> {
  const root = process.cwd();
  const manifestFile = path.resolve(root, opts.dir, ".specregistry.json");
  let typeName = opts.type;
  if (!typeName && fs.existsSync(manifestFile)) {
    typeName = (JSON.parse(fs.readFileSync(manifestFile, "utf8")) as { project_type?: string }).project_type;
  }
  if (!typeName) typeName = (await selectProjectType(opts.server, undefined)).name;

  console.log(`Scanning ${root} ...`);
  const scan = scanDirectory(root);
  const files = collectFiles(root);
  console.log(`Auditing ${files.length} sampled file(s) against the "${typeName}" spec set (this calls Claude — may take a minute)...`);

  const { findings } = await fetchJson<{ findings: AuditFinding[] }>(`${opts.server}/api/v1/ai/audit`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ project_type: typeName, tree: scan.tree, files }),
  });

  if (findings.length === 0) {
    console.log("\nNo spec violations found in the sampled snapshot.");
    return;
  }
  console.log(`\n${findings.length} finding(s):\n`);
  const order = { high: 0, medium: 1, low: 2 };
  findings.sort((a, b) => order[a.severity] - order[b.severity]);
  for (const f of findings) {
    console.log(`[${f.severity.toUpperCase()}] ${f.file}`);
    console.log(`  Spec: ${f.spec} › ${f.section}`);
    console.log(`  ${f.description}`);
    console.log(`  Fix: ${f.recommendation}\n`);
  }
  if (opts.ci) process.exit(1);
}
