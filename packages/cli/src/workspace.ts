import fs from "node:fs";
import path from "node:path";
import type { Manifest } from "./repo.js";

export interface RegistryWorkspace {
  root: string;
  specsDir: string;
  manifestPath: string;
  manifest?: Manifest;
}

function readManifest(file: string): Manifest | undefined {
  if (!fs.existsSync(file)) return undefined;
  return JSON.parse(fs.readFileSync(file, "utf8")) as Manifest;
}

export function resolveRegistryWorkspace(specsDir = "specs", start = process.cwd()): RegistryWorkspace {
  if (path.isAbsolute(specsDir)) {
    const manifestPath = path.join(specsDir, ".specregistry.json");
    return {
      root: start,
      specsDir,
      manifestPath,
      manifest: readManifest(manifestPath),
    };
  }

  let current = path.resolve(start);
  while (true) {
    const manifestPath = path.join(current, specsDir, ".specregistry.json");
    const manifest = readManifest(manifestPath);
    if (manifest) {
      return {
        root: current,
        specsDir,
        manifestPath,
        manifest,
      };
    }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }

  const root = path.resolve(start);
  return {
    root,
    specsDir,
    manifestPath: path.join(root, specsDir, ".specregistry.json"),
  };
}
