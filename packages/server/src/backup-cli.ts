import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadServerEnv } from "./env.js";
import { createDb } from "./db.js";
import { listBackups, readBackupConfig, restoreBackup, runBackup, verifyBackup } from "./lib/backup.js";

/**
 * Ops CLI for registry backups:
 *   npm run backup -w @specregistry/server -- now
 *   npm run backup -w @specregistry/server -- list
 *   npm run backup -w @specregistry/server -- verify <file>
 *   npm run backup -w @specregistry/server -- restore <file>   (run with the server stopped)
 *
 * Honors SPECREG_DB, SPECREG_BACKUP_DIR, and SPECREG_BACKUP_KEEP.
 */
loadServerEnv();

const here = path.dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.SPECREG_DB ?? path.resolve(here, "../../..", "specregistry.db");
const config = readBackupConfig();
const [command, arg] = process.argv.slice(2);

function usage(): never {
  console.error("Usage: backup <now|list|verify <file>|restore <file>>");
  process.exit(1);
}

switch (command) {
  case "now": {
    if (!config.dir) throw new Error("Set SPECREG_BACKUP_DIR to choose where backups are written.");
    const db = createDb(dbPath);
    const info = await runBackup(db, config);
    db.close();
    console.log(`Wrote ${info.file} (${info.bytes} bytes)\n  sha256 ${info.sha256}`);
    break;
  }
  case "list": {
    const backups = listBackups(config.dir);
    if (backups.length === 0) {
      console.log(config.dir ? `No backups in ${config.dir}.` : "SPECREG_BACKUP_DIR is not set.");
      break;
    }
    for (const b of backups) console.log(`${b.name}\t${b.bytes} bytes\t${b.created_at}\t${b.sha256 ?? "(no checksum)"}`);
    break;
  }
  case "verify": {
    if (!arg) usage();
    const result = verifyBackup(path.resolve(arg));
    console.log(`integrity: ${result.integrity}`);
    console.log(`checksum:  ${result.sha256_matches === null ? "no sidecar to compare" : result.sha256_matches ? "matches" : "MISMATCH"}`);
    if (!result.ok) process.exit(1);
    break;
  }
  case "restore": {
    if (!arg) usage();
    const result = restoreBackup({ dbPath, file: path.resolve(arg) });
    console.log(`Restored ${arg} -> ${dbPath} (integrity ${result.integrity}). Start the server to use it.`);
    break;
  }
  default:
    usage();
}
