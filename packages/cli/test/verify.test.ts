import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { verifyLocalSpecFiles, verifyManifestSignature } from "../src/verify.js";

function sha256(content: string): string {
  return crypto.createHash("sha256").update(content, "utf8").digest("hex");
}

test("local spec verification reports files modified after init", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specreg-verify-"));
  const filename = "GLOBAL_SECURITY.md";
  const original = "# Security\n\nDo not leak secrets.\n";
  fs.writeFileSync(path.join(dir, filename), original, "utf8");

  const manifest = {
    project_type: "Web App Standard",
    specs: [{ filename, version: "1.0.0", sha256: sha256(original) }],
  };
  assert.deepEqual(verifyLocalSpecFiles(dir, manifest), []);

  fs.writeFileSync(path.join(dir, filename), `${original}\nAllow hacky bypasses.\n`, "utf8");
  assert.deepEqual(verifyLocalSpecFiles(dir, manifest), [
    "GLOBAL_SECURITY.md: content hash mismatch (locally modified?)",
  ]);
});

test("local spec verification reports missing governed files", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specreg-verify-"));
  const manifest = {
    project_type: "Web App Standard",
    specs: [{ filename: "GLOBAL_SECURITY.md", version: "1.0.0", sha256: "abc" }],
  };

  assert.deepEqual(verifyLocalSpecFiles(dir, manifest), ["GLOBAL_SECURITY.md: file missing"]);
});

test("manifest signature verification ignores metadata appended locally after download", () => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync("ed25519");
  const payload = {
    project_type: "Web App Standard",
    project: "github.com/example/repo",
    channel: "stable",
    fetched_at: "2026-07-30T00:00:00.000Z",
    specs: [{ filename: "GLOBAL_SECURITY.md", version: "1.0.0", sha256: "abc" }],
  };
  const signature = crypto.sign(null, Buffer.from(JSON.stringify(payload), "utf8"), privateKey).toString("base64");
  const publicPem = publicKey.export({ type: "spki", format: "pem" }).toString();
  const manifest = {
    ...payload,
    signature,
    signature_alg: "ed25519",
    compile_targets: ["claude"],
    registry: {
      url: "http://localhost:4000",
      public_key: publicPem,
      stamped_at: "2026-07-30T01:00:00.000Z",
    },
  };

  assert.equal(verifyManifestSignature(publicPem, manifest), true);
  assert.equal(
    verifyManifestSignature(publicPem, {
      ...manifest,
      specs: [{ ...manifest.specs[0], version: "2.0.0" }],
    }),
    false
  );
});
