import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function parseEnv(content: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const normalized = line.startsWith("export ") ? line.slice(7).trimStart() : line;
    const equals = normalized.indexOf("=");
    if (equals <= 0) continue;
    const key = normalized.slice(0, equals).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    let value = normalized.slice(equals + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    } else {
      const comment = value.search(/\s#/);
      if (comment >= 0) value = value.slice(0, comment).trimEnd();
    }
    values[key] = value;
  }
  return values;
}

export function loadEnvFiles(files: string[]): string[] {
  const loaded: string[] = [];
  for (const file of files) {
    if (!fs.existsSync(file)) continue;
    const parsed = parseEnv(fs.readFileSync(file, "utf8"));
    for (const [key, value] of Object.entries(parsed)) {
      if (process.env[key] === undefined) process.env[key] = value;
    }
    loaded.push(file);
  }
  return loaded;
}

export function loadServerEnv(): string[] {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(here, "../../..");
  const packageRoot = path.resolve(here, "..");
  return loadEnvFiles([
    path.resolve(process.cwd(), ".env"),
    path.resolve(packageRoot, ".env"),
    path.resolve(repoRoot, ".env"),
  ]);
}
