import crypto from "node:crypto";
import type { Db } from "../db.js";

/**
 * Bundle signing: an ed25519 keypair is generated on first use and persisted in
 * the settings table. Manifests are signed over their canonical JSON (without the
 * signature fields), so CLIs can verify provenance offline against the public key.
 */
function getKeyPair(db: Db): { privateKey: crypto.KeyObject; publicPem: string } {
  const rows = db.prepare("SELECT key, value FROM settings WHERE key IN ('signing_private', 'signing_public')").all() as Array<{
    key: string;
    value: string;
  }>;
  const map = new Map(rows.map((r) => [r.key, r.value]));
  let privatePem = map.get("signing_private");
  let publicPem = map.get("signing_public");
  if (!privatePem || !publicPem) {
    const pair = crypto.generateKeyPairSync("ed25519");
    privatePem = pair.privateKey.export({ type: "pkcs8", format: "pem" }).toString();
    publicPem = pair.publicKey.export({ type: "spki", format: "pem" }).toString();
    const upsert = db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)");
    upsert.run("signing_private", privatePem);
    upsert.run("signing_public", publicPem);
  }
  return { privateKey: crypto.createPrivateKey(privatePem), publicPem };
}

export function getPublicKey(db: Db): string {
  return getKeyPair(db).publicPem;
}

export function sha256(content: string): string {
  return crypto.createHash("sha256").update(content, "utf8").digest("hex");
}

/** Returns the manifest with `signature` + `signature_alg` appended. */
export function signManifest<T extends Record<string, unknown>>(
  db: Db,
  manifest: T
): T & { signature: string; signature_alg: string } {
  const { privateKey } = getKeyPair(db);
  const signature = crypto.sign(null, Buffer.from(JSON.stringify(manifest), "utf8"), privateKey).toString("base64");
  return { ...manifest, signature, signature_alg: "ed25519" };
}

export function verifyManifest(publicPem: string, manifest: Record<string, unknown>): boolean {
  const { signature, signature_alg: _alg, ...payload } = manifest;
  if (typeof signature !== "string") return false;
  try {
    return crypto.verify(
      null,
      Buffer.from(JSON.stringify(payload), "utf8"),
      crypto.createPublicKey(publicPem),
      Buffer.from(signature, "base64")
    );
  } catch {
    return false;
  }
}
