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
  out?: string;
  json?: boolean;
}

function summarize(report: AuditReportSummary): string {
  const label = report.report_type === "spec_quality" ? "spec quality" : "project governance";
  return [
    `Generated ${label} audit for ${report.subject_label}`,
    `Status: ${report.status.toUpperCase()}`,
    `Report id: ${report.id}`,
    `Generated at: ${report.created_at}`,
  ].join("\n");
}

export async function runAuditReport(opts: AuditReportOptions): Promise<void> {
  if (opts.project && opts.spec) throw new Error("Use either --project or --spec, not both.");
  const endpoint = opts.spec ? "/api/v1/audit-reports/spec" : "/api/v1/audit-reports/project";
  const body = opts.spec ? { spec_id: opts.spec.trim() } : { project: opts.project?.trim() || repoIdentity().repo };
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
