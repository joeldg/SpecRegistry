import type { Db } from "../db.js";
import { bundleSpecs } from "./compile.js";

export function projectSpecCurrency(db: Db, consumerId: string, projectTypeId: string): { spec_count: number; outdated_count: number } {
  const local = db
    .prepare("SELECT filename, version FROM repo_consumer_specs WHERE consumer_id = ?")
    .all(consumerId) as Array<{ filename: string; version: string }>;
  const latest = new Map(bundleSpecs(db, projectTypeId, "stable", consumerId).map((spec) => [spec.filename, spec.current_version]));
  let outdated = 0;
  for (const spec of local) {
    const latestVersion = latest.get(spec.filename);
    if (latestVersion && latestVersion !== spec.version) outdated++;
  }
  return { spec_count: local.length, outdated_count: outdated };
}
