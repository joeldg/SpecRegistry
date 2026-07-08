import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import Database from "better-sqlite3";
import type { Db } from "../db.js";

export interface BackupConfig {
  /** directory backups are written to; backups are disabled when empty */
  dir: string;
  /** interval between scheduled backups, in seconds; 0 disables the scheduler */
  intervalSeconds: number;
  /** how many recent backups to retain (older ones are pruned) */
  keep: number;
}

export interface BackupInfo {
  file: string;
  name: string;
  bytes: number;
  created_at: string;
  sha256: string | null;
}

const BACKUP_PREFIX = "specregistry-";
const BACKUP_SUFFIX = ".db";
const NAME_RE = /^specregistry-\d{8}T\d{6}Z\.db$/;

/** Read backup settings from the environment. Backups are off unless a dir is set. */
export function readBackupConfig(env: NodeJS.ProcessEnv = process.env): BackupConfig {
  const interval = Number(env.SPECREG_BACKUP_INTERVAL);
  const keep = Number(env.SPECREG_BACKUP_KEEP);
  return {
    dir: (env.SPECREG_BACKUP_DIR ?? "").trim(),
    intervalSeconds: Number.isFinite(interval) && interval > 0 ? interval : 0,
    keep: Number.isFinite(keep) && keep > 0 ? Math.floor(keep) : 14,
  };
}

function timestampName(date = new Date()): string {
  // Sortable, filesystem-safe UTC stamp: specregistry-20260708T193012Z.db
  const iso = date.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  return `${BACKUP_PREFIX}${iso}${BACKUP_SUFFIX}`;
}

function sha256File(file: string): string {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

/**
 * Take a consistent online snapshot of the registry database. Uses better-sqlite3's
 * backup API, which safely captures a WAL-mode database while the server is running,
 * then writes a `<name>.sha256` sidecar and prunes older backups beyond `keep`.
 */
export async function runBackup(db: Db, config: Pick<BackupConfig, "dir" | "keep">): Promise<BackupInfo> {
  if (!config.dir) throw new Error("Backup directory is not configured (set SPECREG_BACKUP_DIR).");
  fs.mkdirSync(config.dir, { recursive: true });
  const name = timestampName();
  const file = path.join(config.dir, name);
  await db.backup(file);
  const sha256 = sha256File(file);
  fs.writeFileSync(`${file}.sha256`, `${sha256}  ${name}\n`, "utf8");
  pruneBackups(config.dir, config.keep);
  return { file, name, bytes: fs.statSync(file).size, created_at: new Date().toISOString(), sha256 };
}

/** List backups in a directory, newest first. */
export function listBackups(dir: string): BackupInfo[] {
  if (!dir || !fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => NAME_RE.test(name))
    .sort()
    .reverse()
    .map((name) => {
      const file = path.join(dir, name);
      const stat = fs.statSync(file);
      const sidecar = `${file}.sha256`;
      const sha256 = fs.existsSync(sidecar) ? (fs.readFileSync(sidecar, "utf8").trim().split(/\s+/)[0] ?? null) : null;
      return { file, name, bytes: stat.size, created_at: stat.mtime.toISOString(), sha256 };
    });
}

/** Delete backups (and their sidecars) beyond the newest `keep`. */
export function pruneBackups(dir: string, keep: number): string[] {
  const backups = listBackups(dir);
  const removed: string[] = [];
  for (const backup of backups.slice(Math.max(0, keep))) {
    fs.rmSync(backup.file, { force: true });
    fs.rmSync(`${backup.file}.sha256`, { force: true });
    removed.push(backup.name);
  }
  return removed;
}

export interface VerifyResult {
  ok: boolean;
  sha256: string;
  sha256_matches: boolean | null;
  integrity: string;
}

/**
 * Verify a backup is intact: recompute its checksum against the sidecar (when present)
 * and run SQLite's own `PRAGMA integrity_check` on a read-only open.
 */
export function verifyBackup(file: string): VerifyResult {
  if (!fs.existsSync(file)) throw new Error(`Backup file not found: ${file}`);
  const sha256 = sha256File(file);
  const sidecar = `${file}.sha256`;
  const expected = fs.existsSync(sidecar) ? (fs.readFileSync(sidecar, "utf8").trim().split(/\s+/)[0] ?? null) : null;
  const sha256Matches = expected === null ? null : expected === sha256;
  let integrity = "unknown";
  try {
    const probe = new Database(file, { readonly: true, fileMustExist: true });
    try {
      integrity = String((probe.pragma("integrity_check", { simple: true }) as unknown) ?? "unknown");
    } finally {
      probe.close();
    }
  } catch (err) {
    // A truncated/garbage file (not a valid SQLite database) throws on open.
    integrity = `unreadable: ${err instanceof Error ? err.message : String(err)}`;
  }
  return { ok: integrity === "ok" && sha256Matches !== false, sha256, sha256_matches: sha256Matches, integrity };
}

/**
 * Restore a backup over the live database file. Must run with the server stopped.
 * Verifies the backup first, then replaces the db file and clears any stale WAL/SHM
 * sidecars so SQLite does not replay an old journal over the restored snapshot.
 */
export function restoreBackup(opts: { dbPath: string; file: string; skipVerify?: boolean }): VerifyResult {
  const result = opts.skipVerify ? undefined : verifyBackup(opts.file);
  if (result && !result.ok) {
    throw new Error(`Refusing to restore a backup that failed verification (integrity=${result.integrity}, checksum ok=${result.sha256_matches}).`);
  }
  fs.copyFileSync(opts.file, opts.dbPath);
  for (const sidecar of [`${opts.dbPath}-wal`, `${opts.dbPath}-shm`]) {
    fs.rmSync(sidecar, { force: true });
  }
  return result ?? verifyBackup(opts.dbPath);
}

/**
 * Start the built-in backup scheduler. Runs one backup shortly after boot and then
 * every `intervalSeconds`. Returns a stop function. A no-op (returns a no-op stopper)
 * when no directory or a non-positive interval is configured.
 */
export function startBackupScheduler(
  db: Db,
  config: BackupConfig,
  log: (message: string) => void = console.log
): () => void {
  if (!config.dir || config.intervalSeconds <= 0) return () => {};
  let running = false;
  const tick = async () => {
    if (running) return; // never overlap a slow backup with the next tick
    running = true;
    try {
      const info = await runBackup(db, config);
      log(`[backup] wrote ${info.name} (${info.bytes} bytes), keeping ${config.keep}`);
    } catch (err) {
      log(`[backup] FAILED: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      running = false;
    }
  };
  // Kick off an initial backup soon after boot, then on the configured cadence.
  const initial = setTimeout(tick, 5_000);
  const interval = setInterval(tick, config.intervalSeconds * 1_000);
  return () => {
    clearTimeout(initial);
    clearInterval(interval);
  };
}
