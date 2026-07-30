import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

test("standalone CLI has no runtime import of the shared workspace package", () => {
  const srcDir = path.resolve(import.meta.dirname, "../src");
  const offenders = fs
    .readdirSync(srcDir)
    .filter((filename) => filename.endsWith(".ts"))
    .filter((filename) => {
      const source = fs.readFileSync(path.join(srcDir, filename), "utf8");
      return /^\s*import\s+(?!type\b)[^;\n]*from\s+["']@specregistry\/shared["']/m.test(source);
    });

  assert.deepEqual(
    offenders,
    [],
    `Runtime imports make the downloaded CLI depend on an unavailable workspace package: ${offenders.join(", ")}`
  );
});
