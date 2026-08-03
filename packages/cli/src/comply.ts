import { fetchJson } from "./registry.js";
import { writeCodeInventory } from "./codeMetadata.js";
import { repoIdentity } from "./repo.js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export interface ComplyOptions {
  server: string;
  token?: string;
  type: string;
  dir: string;
  root?: string;
  /** agent's honest self-assessed compliance score (0-100) */
  score?: number;
  /** generate trace evidence in a temporary directory instead of mutating sidecars */
  writeEvidence?: boolean;
}

interface ComplianceVerdict {
  compliant: boolean;
  objective_score: number;
  self_assessed_score: number | null;
  over_claimed: boolean;
  coverage_ratio: number | null;
  drift_score: number | null;
  iteration: number;
  outstanding: Array<{ check: string; detail: string; recommended_action: string }>;
  directive: string;
}

/**
 * The compliance gate an agent runs before declaring a task done. Regenerates the
 * traceability report from current code, asks the registry for an objective verdict,
 * prints the directive, and exits non-zero when not compliant so CI (and a looping
 * agent) keep going until the work actually satisfies the specs.
 */
export async function runComply(opts: ComplyOptions): Promise<void> {
  const root = opts.root ?? process.cwd();
  console.log("Regenerating code traceability report...");
  const tempDir = opts.writeEvidence === false ? fs.mkdtempSync(path.join(os.tmpdir(), "specreg-comply-")) : undefined;
  let inventory;
  try {
    inventory = writeCodeInventory({
      root,
      out: tempDir ? path.join(tempDir, "code-map.json") : ".spec/code-map.json",
      specsDir: opts.dir,
      traceOut: tempDir ? path.join(tempDir, "code-trace.json") : ".spec/code-trace.json",
      force: true,
    });
  } finally {
    if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
  }
  const cov = Math.round(inventory.trace.coverage.coverage_ratio * 100);
  console.log(`Measured coverage ${cov}%, drift ${inventory.trace.drift.severity} (${inventory.trace.drift.score}).`);

  const identity = repoIdentity();
  const verdict = await fetchJson<ComplianceVerdict>(
    `${opts.server}/api/v1/ai/compliance-check`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        project_type: opts.type,
        repo: identity.repo,
        self_assessed_score: opts.score,
        trace: inventory.trace,
      }),
    },
    opts.token
  );

  console.log(
    `\nCompliance: ${verdict.compliant ? "PASS" : "FAIL"} ` +
      `(objective ${verdict.objective_score}/100${verdict.self_assessed_score !== null ? `, self-assessed ${verdict.self_assessed_score}` : ""}, attempt #${verdict.iteration})`
  );
  if (verdict.over_claimed) {
    console.log("⚠ Self-assessment exceeds measured compliance — re-check your work against the specs.");
  }
  if (verdict.outstanding.length > 0) {
    console.log("\nOutstanding:");
    for (const gap of verdict.outstanding) {
      console.log(`  - [${gap.check}] ${gap.detail}`);
      console.log(`      → ${gap.recommended_action}`);
    }
  }
  console.log(`\n${verdict.directive}`);
  console.log("\nCommit evidence trailer:");
  console.log(`SpecRegistry-Compliance: ${verdict.compliant ? "PASS" : "FAIL"} objective=${verdict.objective_score}/100 attempt=${verdict.iteration}`);
  console.log(
    `SpecRegistry-Signals: coverage=${verdict.coverage_ratio === null ? "n/a" : `${Math.round(verdict.coverage_ratio * 100)}%`} drift=${
      verdict.drift_score === null ? "n/a" : `${Math.round(verdict.drift_score * 100)}%`
    }`
  );
  console.log("SpecRegistry-Command: specreg comply");
  if (!verdict.compliant) process.exit(1);
}
