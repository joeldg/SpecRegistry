import fs from "node:fs";
import path from "node:path";
import type { CodeEntityKind, CodeTraceReport } from "./codeMetadata.js";

export interface TraceCheckOptions {
  tracePath: string;
  minCoverage: number;
  maxDrift: number;
  failOnUnmapped: CodeEntityKind[];
  annotations: "github" | "none";
}

interface Finding {
  level: "error" | "warning";
  title: string;
  message: string;
  file?: string;
  line?: number;
}

function parseThreshold(value: string | boolean | undefined, fallback: number): number {
  if (typeof value !== "string" || !value.trim()) return fallback;
  const trimmed = value.trim();
  const numeric = Number(trimmed.endsWith("%") ? trimmed.slice(0, -1) : trimmed);
  if (!Number.isFinite(numeric)) throw new Error(`Invalid threshold: ${value}`);
  const ratio = trimmed.endsWith("%") || numeric > 1 ? numeric / 100 : numeric;
  return Math.max(0, Math.min(1, ratio));
}

export function traceThreshold(value: string | boolean | undefined, fallback: number): number {
  return parseThreshold(value, fallback);
}

export function traceKinds(value: string | boolean | undefined, fallback: CodeEntityKind[]): CodeEntityKind[] {
  if (typeof value !== "string" || !value.trim()) return fallback;
  return value.split(",").map((item) => item.trim()).filter(Boolean) as CodeEntityKind[];
}

function readTrace(tracePath: string): CodeTraceReport {
  const resolved = path.resolve(process.cwd(), tracePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`No code trace report at ${tracePath}. Run \`specreg code-map\` first.`);
  }
  return JSON.parse(fs.readFileSync(resolved, "utf8")) as CodeTraceReport;
}

function esc(value: string): string {
  return value.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A").replace(/:/g, "%3A").replace(/,/g, "%2C");
}

function emitGithubAnnotation(finding: Finding): void {
  const props = [`title=${esc(finding.title)}`];
  if (finding.file) props.unshift(`file=${esc(finding.file)}`);
  if (finding.line && finding.line > 0) props.push(`line=${finding.line}`);
  console.log(`::${finding.level} ${props.join(",")}::${esc(finding.message)}`);
}

function findingSummary(finding: Finding): string {
  const loc = finding.file ? `${finding.file}${finding.line ? `:${finding.line}` : ""} ` : "";
  return `${finding.level.toUpperCase()}: ${loc}${finding.title} - ${finding.message}`;
}

export function evaluateTrace(trace: CodeTraceReport, opts: Omit<TraceCheckOptions, "tracePath" | "annotations">): Finding[] {
  const findings: Finding[] = [];
  const coverage = Number(trace.coverage?.coverage_ratio ?? 0);
  const drift = Number(trace.drift?.score ?? 0);
  if (coverage < opts.minCoverage) {
    findings.push({
      level: "error",
      title: "Code-to-spec coverage below threshold",
      message: `Coverage is ${Math.round(coverage * 100)}%; required minimum is ${Math.round(opts.minCoverage * 100)}%.`,
    });
  }
  if (drift > opts.maxDrift) {
    findings.push({
      level: "error",
      title: "Code drift above threshold",
      message: `Drift score is ${drift}; allowed maximum is ${opts.maxDrift}. Severity: ${trace.drift?.severity ?? "unknown"}.`,
    });
  }
  const failKinds = new Set(opts.failOnUnmapped);
  for (const entity of trace.unlinked_entities ?? []) {
    if (!failKinds.has(entity.kind)) continue;
    findings.push({
      level: "error",
      title: `Unmapped ${entity.kind}`,
      message: `${entity.name} is not linked to a governing spec. Either link it, add a spec, or explicitly waive it in review.`,
      file: entity.path,
      line: entity.start_line,
    });
  }
  if ((trace.unlinked_entities?.length ?? 0) > 0 && findings.length === 0) {
    findings.push({
      level: "warning",
      title: "Unmapped code entities present",
      message: `${trace.unlinked_entities.length} code entities are unmapped, but none match the fail-on-unmapped kinds.`,
    });
  }
  return findings;
}

export function runTraceCheck(opts: TraceCheckOptions): boolean {
  const trace = readTrace(opts.tracePath);
  const findings = evaluateTrace(trace, opts);
  console.log(`Code trace report: ${opts.tracePath}`);
  console.log(`  Coverage: ${Math.round(Number(trace.coverage.coverage_ratio ?? 0) * 100)}% (${trace.coverage.linked_entity_count}/${trace.coverage.governed_entity_count})`);
  console.log(`  Drift:    ${trace.drift.severity} (${trace.drift.score})`);
  console.log(`  Unmapped: ${trace.coverage.unlinked_entity_count}`);
  for (const finding of findings) {
    if (opts.annotations === "github") emitGithubAnnotation(finding);
    console.log(findingSummary(finding));
  }
  return findings.every((finding) => finding.level !== "error");
}
