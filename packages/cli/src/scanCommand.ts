import { buildCodeInventory, type CodeEntity, type TraceabilityLink } from "./codeMetadata.js";

export interface ScanOptions {
  /** repo/directory to scan (default: cwd) */
  root?: string;
  /** spec directory to score against (default: specs) */
  dir?: string;
  /** emit the machine-readable report to stdout instead of the human summary */
  json?: boolean;
}

export interface ScanReport {
  schema_version: 1;
  root: string;
  /** single headline 0-100 governance score (null when there is no governable code) */
  governance_score: number | null;
  grade: string;
  /** the shareable "scary number": percent of governable code linked to no spec */
  ungoverned_pct: number;
  headline: string;
  spec_count: number;
  governed_entity_count: number;
  linked_entity_count: number;
  unlinked_entity_count: number;
  coverage_pct: number;
  drift_severity: string;
  /** `@spec` annotations that point at a spec/section that does not exist */
  annotation_theater_count: number;
  ungoverned_by_kind: Record<string, number>;
  languages: string[];
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function gradeFor(score: number): string {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  if (score >= 40) return "D";
  return "F";
}

/**
 * Count `@spec[FILE#section]` annotations that resolve to nothing — "annotation
 * theater". An entity carrying a `spec_ref` whose filename never produced an
 * explicit-annotation link (the file does not exist), or whose section was flagged
 * "not found in spec", is a tag that looks like governance but maps to nothing.
 */
function countAnnotationTheater(entities: CodeEntity[], links: TraceabilityLink[]): number {
  const linksByEntity = new Map<string, TraceabilityLink[]>();
  for (const link of links) {
    const list = linksByEntity.get(link.entity_id) ?? [];
    list.push(link);
    linksByEntity.set(link.entity_id, list);
  }
  let theater = 0;
  for (const entity of entities) {
    const specRef = typeof entity.metadata?.spec_ref === "string" ? entity.metadata.spec_ref : undefined;
    if (!specRef) continue;
    const entityLinks = linksByEntity.get(entity.id) ?? [];
    const annotationLink = entityLinks.find((link) => link.reasons.includes("explicit @spec annotation"));
    if (!annotationLink) {
      // The referenced spec filename resolved to no spec at all.
      theater++;
      continue;
    }
    if (annotationLink.reasons.some((reason) => reason.includes("not found in spec"))) {
      // The file exists but the cited section does not.
      theater++;
    }
  }
  return theater;
}

/**
 * Produce a deterministic governance snapshot for a repository. Read-only, requires
 * no server, no login, and no enrollment — the free "scary number" that opens the
 * funnel. Enforcement, history, and signed/auditor-ready proof stay in the governed
 * (paid) control plane; this command never fails CI on its own.
 */
export function buildScanReport(opts: ScanOptions = {}): ScanReport {
  const root = opts.root ?? process.cwd();
  const specsDir = opts.dir ?? "specs";
  const inventory = buildCodeInventory(root, specsDir);
  const { coverage, drift } = inventory.trace;

  const coveragePct = Math.round(coverage.coverage_ratio * 100);
  const hasGovernableCode = coverage.governed_entity_count > 0;
  const ungovernedPct = hasGovernableCode ? 100 - coveragePct : 0;
  const theater = countAnnotationTheater(inventory.entities, inventory.trace.links);

  let governanceScore: number | null = null;
  if (hasGovernableCode) {
    // Annotation theater is worse than a plain gap: it is deceptive governance, so
    // it costs more than the coverage it fraudulently claims. Cap the penalty so a
    // repo is never punished more for theater than for having no specs at all.
    const theaterPenalty = clamp(Math.round((theater / coverage.governed_entity_count) * 60), 0, 15);
    governanceScore = clamp(coveragePct - theaterPenalty, 0, 100);
  }

  const headline = !hasGovernableCode
    ? "No governable code entities were found to scan."
    : ungovernedPct > 0
      ? `${ungovernedPct}% of your code is governed by nothing.`
      : "Every governable code entity maps to a spec.";

  return {
    schema_version: 1,
    root: inventory.root,
    governance_score: governanceScore,
    grade: governanceScore === null ? "n/a" : gradeFor(governanceScore),
    ungoverned_pct: ungovernedPct,
    headline,
    spec_count: inventory.trace.spec_count,
    governed_entity_count: coverage.governed_entity_count,
    linked_entity_count: coverage.linked_entity_count,
    unlinked_entity_count: coverage.unlinked_entity_count,
    coverage_pct: coveragePct,
    drift_severity: drift.severity,
    annotation_theater_count: theater,
    ungoverned_by_kind: coverage.unlinked_by_kind,
    languages: inventory.languages,
  };
}

function formatSummary(report: ScanReport): string {
  const lines: string[] = [];
  lines.push(`SpecRegistry governance scan — ${report.root}`);
  lines.push("");
  lines.push(`  ▸ ${report.headline}`);
  lines.push("");
  if (report.governance_score !== null) {
    lines.push(`  Governance Score   ${report.governance_score}/100  (${report.grade})`);
  } else {
    lines.push(`  Governance Score   n/a`);
  }
  lines.push(`  Coverage           ${report.coverage_pct}%  (${report.linked_entity_count}/${report.governed_entity_count} governable entities linked to a spec)`);
  lines.push(`  Drift              ${report.drift_severity}`);
  lines.push(`  Specs scanned      ${report.spec_count}`);
  if (report.annotation_theater_count > 0) {
    lines.push(`  Annotation theater ${report.annotation_theater_count}  (@spec tags that point at a spec/section that does not exist)`);
  }
  const topKinds = Object.entries(report.ungoverned_by_kind)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([kind, count]) => `${count} ${kind}`);
  if (topKinds.length > 0) {
    lines.push(`  Ungoverned         ${report.unlinked_entity_count}  (${topKinds.join(", ")})`);
  }
  if (report.languages.length > 0) {
    lines.push(`  Languages          ${report.languages.join(", ")}`);
  }
  lines.push("");
  lines.push("  This is a read-only snapshot — nothing was uploaded and no files were written.");
  lines.push("  To enforce coverage in CI and produce signed, auditor-ready proof, govern");
  lines.push("  this repo with SpecRegistry: run `specreg init`, then `specreg comply`.");
  return lines.join("\n");
}

/** CLI entrypoint for `specreg scan`. Always exits 0 — a scan reports, it never gates. */
export function runScan(opts: ScanOptions = {}): void {
  const report = buildScanReport(opts);
  if (opts.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(formatSummary(report));
  }
}
