import type { FastifyInstance } from "fastify";
import type { Db } from "../db.js";
import { now, uuid } from "../db.js";
import { findProjectConsumer, requireString } from "../helpers.js";

export interface CodeTracePayload {
  schema_version?: unknown;
  generated_at?: unknown;
  specs_dir?: unknown;
  spec_count?: unknown;
  entity_count?: unknown;
  links?: unknown;
  unlinked_entities?: unknown;
  aliases?: unknown;
  coverage?: {
    governed_entity_count?: unknown;
    linked_entity_count?: unknown;
    unlinked_entity_count?: unknown;
    coverage_ratio?: unknown;
  };
  drift?: {
    score?: unknown;
    severity?: unknown;
  };
}

export function numberValue(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

/** Upsert the repo consumer for this project type and return its id. */
export function ensureConsumer(app: FastifyInstance, input: Record<string, unknown>, projectTypeId: string): string {
  const repo = requireString(input, "repo");
  const ts = now();
  const existing = app.db
    .prepare("SELECT id, first_seen_at FROM repo_consumers WHERE repo = ? AND project_type_id = ?")
    .get(repo, projectTypeId) as { id: string; first_seen_at: string } | undefined;
  const requested = typeof input.project_id === "string" ? findProjectConsumer(app.db, input.project_id, projectTypeId) : undefined;
  const id = requested?.id ?? existing?.id ?? uuid();
  app.db
    .prepare(
      `INSERT OR REPLACE INTO repo_consumers
       (id, repo, branch, commit_sha, project_type_id, specs_path, manifest_path, source, first_seen_at, last_seen_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      repo,
      typeof input.branch === "string" ? input.branch : null,
      typeof input.commit_sha === "string" ? input.commit_sha : null,
      projectTypeId,
      typeof input.specs_path === "string" ? input.specs_path : "specs",
      typeof input.manifest_path === "string" ? input.manifest_path : "specs/.specregistry.json",
      typeof input.source === "string" ? input.source : "cli",
      existing?.first_seen_at ?? ts,
      ts
    );
  return id;
}

/**
 * Persist a code-trace report (and its links) as the consumer's latest stored
 * signals. Shared by the explicit `code-map --report` upload and the compliance
 * gates: when `specreg comply`/`finish_task` sends a trace inline, storing it here
 * means a later no-trace `check_compliance`/`finish_task` reads the same signals,
 * so the two gates can no longer contradict each other. The caller owns the
 * surrounding transaction.
 */
export function persistCodeTrace(db: Db, consumerId: string, rawTrace: Record<string, unknown>): { reportId: string; createdAt: string } {
  const trace = rawTrace as CodeTracePayload;
  const links = Array.isArray(trace.links) ? (trace.links.slice(0, 500) as Array<Record<string, unknown>>) : [];
  const unlinked = Array.isArray(trace.unlinked_entities) ? trace.unlinked_entities.slice(0, 50) : [];
  const aliases = Array.isArray(trace.aliases) ? trace.aliases : [];
  const ts = now();
  const reportId = uuid();
  db.prepare(
    `INSERT INTO code_trace_reports
     (id, consumer_id, generated_at, specs_dir, spec_count, entity_count,
      governed_entity_count, linked_entity_count, unlinked_entity_count,
      coverage_ratio, drift_score, drift_severity, aliases_count,
      unlinked_sample, raw_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    reportId,
    consumerId,
    stringValue(trace.generated_at, ts),
    stringValue(trace.specs_dir, "specs"),
    numberValue(trace.spec_count),
    numberValue(trace.entity_count),
    numberValue(trace.coverage?.governed_entity_count),
    numberValue(trace.coverage?.linked_entity_count),
    numberValue(trace.coverage?.unlinked_entity_count),
    numberValue(trace.coverage?.coverage_ratio),
    numberValue(trace.drift?.score),
    stringValue(trace.drift?.severity, "none"),
    aliases.length,
    JSON.stringify(unlinked),
    JSON.stringify(trace),
    ts
  );
  const insertLink = db.prepare(
    `INSERT OR REPLACE INTO code_trace_links
     (report_id, entity_id, entity_path, entity_name, entity_kind, spec_filename, confidence, reasons)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  for (const link of links) {
    if (typeof link.entity_id !== "string" || typeof link.spec_filename !== "string") continue;
    insertLink.run(
      reportId,
      link.entity_id,
      typeof link.entity_path === "string" ? link.entity_path : null,
      stringValue(link.entity_name),
      stringValue(link.entity_kind),
      link.spec_filename,
      numberValue(link.confidence),
      JSON.stringify(Array.isArray(link.reasons) ? link.reasons : [])
    );
  }
  return { reportId, createdAt: ts };
}
