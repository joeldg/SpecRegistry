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
  out?: string;
  json?: boolean;
}

function summarize(report: AuditReportSummary): string {
  const label =
    report.report_type === "spec_quality"
      ? "spec quality"
      : report.report_type === "agent_run"
        ? "agent run"
        : "project governance";
  return [
    `Generated ${label} audit for ${report.subject_label}`,
    `Status: ${report.status.toUpperCase()}`,
    `Report id: ${report.id}`,
    `Generated at: ${report.created_at}`,
  ].join("\n");
}

export async function runAuditReport(opts: AuditReportOptions): Promise<void> {
  const explicitTargets = [opts.project, opts.spec, opts.session].filter((value) => typeof value === "string" && value.trim()).length;
  if (explicitTargets > 1) throw new Error("Use only one of --project, --spec, or --session.");
  const endpoint = opts.session
    ? "/api/v1/audit-reports/agent-session"
    : opts.spec
      ? "/api/v1/audit-reports/spec"
      : "/api/v1/audit-reports/project";
  const body = opts.session
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
