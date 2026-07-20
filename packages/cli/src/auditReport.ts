import fs from "node:fs";
import path from "node:path";
import type { AuditReportDetail, AuditReportSummary } from "@specregistry/shared";
import { fetchJson } from "./registry.js";
import { repoIdentity } from "./repo.js";

export interface AuditReportOptions {
  server: string;
  token?: string;
  project?: string;
  spec?: string;
  session?: string;
  release?: boolean;
  registry?: boolean;
  changedFiles?: string;
  tests?: string;
  checks?: string;
  approvals?: string;
  commitEvidence?: string;
  specsLoaded?: string;
  base?: string;
  head?: string;
  url?: string;
  label?: string;
  out?: string;
  json?: boolean;
}

function splitList(value: string | undefined): string[] {
  return value?.split(",").map((item) => item.trim()).filter(Boolean) ?? [];
}

function summarize(report: AuditReportSummary): string {
  const label =
    report.report_type === "spec_quality"
      ? "spec quality"
      : report.report_type === "agent_run"
        ? "agent run"
      : report.report_type === "release"
        ? "release/PR"
        : report.report_type === "registry_operations"
          ? "registry operations"
          : "project governance";
  return [
    `Generated ${label} audit for ${report.subject_label}`,
    `Status: ${report.status.toUpperCase()}`,
    `Report id: ${report.id}`,
    `Generated at: ${report.created_at}`,
  ].join("\n");
}

export async function runAuditReport(opts: AuditReportOptions): Promise<void> {
  const explicitTargets = [opts.spec, opts.session, opts.release ? "release" : undefined, opts.registry ? "registry" : undefined].filter((value) => typeof value === "string" && value.trim()).length;
  if (explicitTargets > 1) throw new Error("Use only one of --spec, --session, --release, or --registry.");
  const endpoint = opts.registry
    ? "/api/v1/audit-reports/registry-operations"
    : opts.release
      ? "/api/v1/audit-reports/release"
      : opts.session
        ? "/api/v1/audit-reports/agent-session"
        : opts.spec
          ? "/api/v1/audit-reports/spec"
          : "/api/v1/audit-reports/project";
  const body = opts.registry
    ? {}
    : opts.release
      ? {
          project: opts.project?.trim() || repoIdentity().repo,
          changed_files: splitList(opts.changedFiles),
          tests: splitList(opts.tests),
          checks: splitList(opts.checks),
          approvals: splitList(opts.approvals),
          commit_evidence: opts.commitEvidence?.trim() || undefined,
          specs_loaded: splitList(opts.specsLoaded),
          base: opts.base?.trim() || undefined,
          head: opts.head?.trim() || repoIdentity().commit_sha,
          url: opts.url?.trim() || undefined,
          label: opts.label?.trim() || undefined,
        }
      : opts.session
        ? { session_id: opts.session.trim() }
        : opts.spec
          ? { spec_id: opts.spec.trim() }
          : { project: opts.project?.trim() || repoIdentity().repo };
  const report = await fetchJson<AuditReportDetail>(
    `${opts.server}${endpoint}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
    opts.token
  );

  if (opts.json) {
    const body = JSON.stringify(report, null, 2) + "\n";
    if (opts.out) {
      const target = path.resolve(process.cwd(), opts.out);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, body, "utf8");
      console.log(`Wrote audit report JSON to ${opts.out}.`);
    } else {
      console.log(body.trimEnd());
    }
    return;
  }

  if (opts.out) {
    const target = path.resolve(process.cwd(), opts.out);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, report.markdown.endsWith("\n") ? report.markdown : `${report.markdown}\n`, "utf8");
    console.log(summarize(report));
    console.log(`Wrote audit report Markdown to ${opts.out}.`);
    return;
  }

  console.log(report.markdown.trimEnd());
}
