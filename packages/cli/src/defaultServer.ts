import fs from "node:fs";

interface InstalledDefaultServer {
  server?: unknown;
}

export function readInstalledDefaultServer(): string | undefined {
  try {
    const file = new URL("./default-server.json", import.meta.url);
    const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as InstalledDefaultServer;
    return typeof parsed.server === "string" && parsed.server.trim() ? parsed.server.trim().replace(/\/+$/, "") : undefined;
  } catch {
    return undefined;
  }
}
