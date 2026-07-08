import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildScanReport } from "../src/scanCommand.js";

function makeRepo(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "specreg-scan-"));
  fs.mkdirSync(path.join(root, "src", "routes"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({ dependencies: { fastify: "^5.0.0" } }, null, 2),
    "utf8"
  );
  fs.writeFileSync(
    path.join(root, "src", "routes", "users.ts"),
    `import fastify from "fastify";

export class UserService {
  findUser(id: string) {
    return id;
  }
}

export function registerRoutes(app: ReturnType<typeof fastify>) {
  app.get("/users/:id", async () => ({ ok: true }));
}
`,
    "utf8"
  );
  return root;
}

test("scan of an ungoverned repo yields a zero coverage 'governed by nothing' headline", () => {
  const root = makeRepo();
  try {
    const report = buildScanReport({ root });
    assert.equal(report.spec_count, 0);
    assert.ok(report.governed_entity_count > 0);
    assert.equal(report.coverage_pct, 0);
    assert.equal(report.ungoverned_pct, 100);
    assert.equal(report.governance_score, 0);
    assert.equal(report.grade, "F");
    assert.match(report.headline, /100% of your code is governed by nothing/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("scan is deterministic — the same repo produces the same score", () => {
  const root = makeRepo();
  try {
    const a = buildScanReport({ root });
    const b = buildScanReport({ root });
    assert.equal(a.governance_score, b.governance_score);
    assert.equal(a.ungoverned_pct, b.ungoverned_pct);
    assert.deepEqual(a.ungoverned_by_kind, b.ungoverned_by_kind);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("scan counts annotation theater — an @spec tag pointing at a spec that does not exist", () => {
  const root = makeRepo();
  try {
    fs.writeFileSync(
      path.join(root, "src", "routes", "orders.ts"),
      `// @spec[NONEXISTENT.md#section]
export function placeOrder() {
  return true;
}
`,
      "utf8"
    );
    const report = buildScanReport({ root });
    assert.ok(report.annotation_theater_count >= 1, "dangling @spec ref should count as theater");
    // Theater must not inflate the score above a repo with real coverage of the same size.
    assert.ok((report.governance_score ?? 100) <= report.coverage_pct);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("scan of an empty repo reports no governable code rather than a false 100", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "specreg-scan-empty-"));
  try {
    const report = buildScanReport({ root });
    assert.equal(report.governed_entity_count, 0);
    assert.equal(report.governance_score, null);
    assert.equal(report.grade, "n/a");
    assert.equal(report.ungoverned_pct, 0);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
