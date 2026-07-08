import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createDb, type Db } from "../src/db.js";
import { seed } from "../src/seed.js";
import { buildAdminTestApp } from "./helpers.js";
import { listBackups, pruneBackups, readBackupConfig, restoreBackup, runBackup, verifyBackup } from "../src/lib/backup.js";

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "specreg-backup-"));
}

function marker(db: Db, value: string): void {
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('backup_marker', ?)").run(value);
}

function readMarker(db: Db): string | undefined {
  return (db.prepare("SELECT value FROM settings WHERE key = 'backup_marker'").get() as { value?: string } | undefined)?.value;
}

describe("registry backup", () => {
  it("writes a checksummed snapshot that verifies clean", async () => {
    const dir = tmpDir();
    const db = createDb(path.join(dir, "reg.db"));
    marker(db, "v1");
    const info = await runBackup(db, { dir: path.join(dir, "backups"), keep: 14 });
    db.close();

    expect(fs.existsSync(info.file)).toBe(true);
    expect(fs.existsSync(`${info.file}.sha256`)).toBe(true);
    const verdict = verifyBackup(info.file);
    expect(verdict.ok).toBe(true);
    expect(verdict.integrity).toBe("ok");
    expect(verdict.sha256_matches).toBe(true);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("restores a snapshot, recovering data changed after the backup", async () => {
    const dir = tmpDir();
    const dbPath = path.join(dir, "reg.db");
    let db = createDb(dbPath);
    marker(db, "v1");
    const info = await runBackup(db, { dir: path.join(dir, "backups"), keep: 14 });
    marker(db, "v2-oops");
    expect(readMarker(db)).toBe("v2-oops");
    db.close();

    restoreBackup({ dbPath, file: info.file });

    db = createDb(dbPath);
    expect(readMarker(db)).toBe("v1");
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("prunes older backups beyond the retention count", async () => {
    const dir = tmpDir();
    const backups = path.join(dir, "backups");
    fs.mkdirSync(backups, { recursive: true });
    // Simulate five historical backups with sortable names + sidecars.
    for (const stamp of ["20260101T000000Z", "20260102T000000Z", "20260103T000000Z", "20260104T000000Z", "20260105T000000Z"]) {
      const name = `specregistry-${stamp}.db`;
      fs.writeFileSync(path.join(backups, name), "x");
      fs.writeFileSync(path.join(backups, `${name}.sha256`), "deadbeef");
    }
    const removed = pruneBackups(backups, 2);
    expect(removed.length).toBe(3);
    const remaining = listBackups(backups).map((b) => b.name);
    // Newest two survive; their sidecars too.
    expect(remaining).toEqual(["specregistry-20260105T000000Z.db", "specregistry-20260104T000000Z.db"]);
    expect(fs.existsSync(path.join(backups, "specregistry-20260101T000000Z.db.sha256"))).toBe(false);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("flags a corrupted backup on verify", async () => {
    const dir = tmpDir();
    const db = createDb(path.join(dir, "reg.db"));
    const info = await runBackup(db, { dir: path.join(dir, "backups"), keep: 14 });
    db.close();
    fs.writeFileSync(info.file, "not a database");
    const verdict = verifyBackup(info.file);
    expect(verdict.ok).toBe(false);
    // A checksum sidecar exists from runBackup, so the tampered file is caught either
    // by the checksum mismatch or the integrity check.
    expect(verdict.sha256_matches === false || verdict.integrity !== "ok").toBe(true);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("reads config from the environment and disables backups when unset", () => {
    const prior = { dir: process.env.SPECREG_BACKUP_DIR, interval: process.env.SPECREG_BACKUP_INTERVAL, keep: process.env.SPECREG_BACKUP_KEEP };
    try {
      delete process.env.SPECREG_BACKUP_DIR;
      delete process.env.SPECREG_BACKUP_INTERVAL;
      delete process.env.SPECREG_BACKUP_KEEP;
      const off = readBackupConfig();
      expect(off.dir).toBe("");
      expect(off.intervalSeconds).toBe(0);
      expect(off.keep).toBe(14);

      process.env.SPECREG_BACKUP_DIR = "/tmp/x";
      process.env.SPECREG_BACKUP_INTERVAL = "3600";
      process.env.SPECREG_BACKUP_KEEP = "7";
      const on = readBackupConfig();
      expect(on).toEqual({ dir: "/tmp/x", intervalSeconds: 3600, keep: 7 });
    } finally {
      if (prior.dir === undefined) delete process.env.SPECREG_BACKUP_DIR;
      else process.env.SPECREG_BACKUP_DIR = prior.dir;
      if (prior.interval === undefined) delete process.env.SPECREG_BACKUP_INTERVAL;
      else process.env.SPECREG_BACKUP_INTERVAL = prior.interval;
      if (prior.keep === undefined) delete process.env.SPECREG_BACKUP_KEEP;
      else process.env.SPECREG_BACKUP_KEEP = prior.keep;
    }
  });

  it("exposes an admin-gated on-demand backup endpoint", async () => {
    const dir = tmpDir();
    const priorDir = process.env.SPECREG_BACKUP_DIR;
    process.env.SPECREG_BACKUP_DIR = path.join(dir, "backups");
    try {
      const db = createDb(path.join(dir, "reg.db"));
      seed(db);
      const app = await buildAdminTestApp(db);
      const res = await app.inject({ method: "POST", url: "/api/v1/admin/backup" });
      expect(res.statusCode).toBe(200);
      expect(fs.existsSync(res.json().file)).toBe(true);
      const list = await app.inject({ method: "GET", url: "/api/v1/admin/backups" });
      expect(list.json().backups.length).toBe(1);
      await app.close();
    } finally {
      if (priorDir === undefined) delete process.env.SPECREG_BACKUP_DIR;
      else process.env.SPECREG_BACKUP_DIR = priorDir;
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
