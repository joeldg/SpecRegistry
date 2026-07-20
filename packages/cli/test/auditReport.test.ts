import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { runAuditReport } from "../src/auditReport.js";

function response(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

function reportBody() {
  return {
    id: "audit-1",
    report_type: "project_governance",
    subject_type: "project",
    subject_id: "project-1",
    subject_label: "github.com/acme/app",
    status: "warning",
    summary: "Warnings need review.",
    generated_by: "cli",
    created_at: "2026-07-19T12:00:00.000Z",
    llm_summary: null,
    evidence: { outstanding_actions: ["Run specreg comply."] },
    markdown: "# Project Governance Audit: github.com/acme/app\n\n## Outstanding Actions\n\n- Run specreg comply.\n",
  };
}

test("audit-report posts the selected project and prints markdown", async () => {
  const originalFetch = globalThis.fetch;
  const originalLog = console.log;
  const logs: string[] = [];
  const requests: Array<{ url: URL; body: any }> = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    requests.push({ url, body: JSON.parse(String(init?.body)) });
    return response(reportBody(), { status: 201 });
  }) as typeof fetch;
  console.log = (...args: unknown[]) => logs.push(args.map(String).join(" "));
  try {
    await runAuditReport({ server: "https://specreg.example.com", project: "github.com/acme/app" });
  } finally {
    globalThis.fetch = originalFetch;
    console.log = originalLog;
  }

  assert.equal(requests[0].url.pathname, "/api/v1/audit-reports/project");
  assert.deepEqual(requests[0].body, { project: "github.com/acme/app" });
  assert.match(logs.join("\n"), /# Project Governance Audit: github\.com\/acme\/app/);
});

test("audit-report writes full JSON evidence when requested", async () => {
  const originalFetch = globalThis.fetch;
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "specreg-audit-report-"));
  const originalCwd = process.cwd();
  globalThis.fetch = (async () => response(reportBody(), { status: 201 })) as typeof fetch;
  try {
    process.chdir(root);
    await runAuditReport({
      server: "https://specreg.example.com",
      project: "project-1",
      out: ".spec/audit/project.json",
      json: true,
    });
  } finally {
    globalThis.fetch = originalFetch;
    process.chdir(originalCwd);
  }

  const written = JSON.parse(fs.readFileSync(path.join(root, ".spec/audit/project.json"), "utf8"));
  assert.equal(written.id, "audit-1");
  assert.equal(written.evidence.outstanding_actions[0], "Run specreg comply.");
});

test("audit-report can generate spec quality reports", async () => {
  const originalFetch = globalThis.fetch;
  const requests: Array<{ url: URL; body: any }> = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    requests.push({ url, body: JSON.parse(String(init?.body)) });
    return response({
      ...reportBody(),
      report_type: "spec_quality",
      subject_type: "spec",
      subject_id: "spec-1",
      subject_label: "API.md",
      markdown: "# Spec Quality Audit: API.md\n",
    }, { status: 201 });
  }) as typeof fetch;
  try {
    await runAuditReport({ server: "https://specreg.example.com", spec: "spec-1" });
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(requests[0].url.pathname, "/api/v1/audit-reports/spec");
  assert.deepEqual(requests[0].body, { spec_id: "spec-1" });
});

test("audit-report can generate agent run reports", async () => {
  const originalFetch = globalThis.fetch;
  const requests: Array<{ url: URL; body: any }> = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    requests.push({ url, body: JSON.parse(String(init?.body)) });
    return response({
      ...reportBody(),
      report_type: "agent_run",
      subject_type: "agent_session",
      subject_id: "session-1",
      subject_label: "agent: implement feature",
      markdown: "# Agent Run Audit: session-1\n",
    }, { status: 201 });
  }) as typeof fetch;
  try {
    await runAuditReport({ server: "https://specreg.example.com", session: "session-1" });
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(requests[0].url.pathname, "/api/v1/audit-reports/agent-session");
  assert.deepEqual(requests[0].body, { session_id: "session-1" });
});

test("audit-report can generate release PR reports", async () => {
  const originalFetch = globalThis.fetch;
  const requests: Array<{ url: URL; body: any }> = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    requests.push({ url, body: JSON.parse(String(init?.body)) });
    return response({
      ...reportBody(),
      report_type: "release",
      subject_type: "release",
      subject_id: "project-1",
      subject_label: "PR #12",
      markdown: "# Release/PR Audit: PR #12\n",
    }, { status: 201 });
  }) as typeof fetch;
  try {
    await runAuditReport({
      server: "https://specreg.example.com",
      project: "github.com/acme/app",
      release: true,
      changedFiles: "src/app.ts, src/routes.ts",
      tests: "npm test",
      checks: "unit, lint",
      approvals: "reviewer-approved",
      commitEvidence: "SpecRegistry-Compliance: PASS",
      specsLoaded: "API.md, STRUCTURE.md",
      base: "main",
      head: "abc123",
      url: "https://github.com/acme/app/pull/12",
      label: "PR #12",
    });
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(requests[0].url.pathname, "/api/v1/audit-reports/release");
  assert.deepEqual(requests[0].body, {
    project: "github.com/acme/app",
    changed_files: ["src/app.ts", "src/routes.ts"],
    tests: ["npm test"],
    checks: ["unit", "lint"],
    approvals: ["reviewer-approved"],
    commit_evidence: "SpecRegistry-Compliance: PASS",
    specs_loaded: ["API.md", "STRUCTURE.md"],
    base: "main",
    head: "abc123",
    url: "https://github.com/acme/app/pull/12",
    label: "PR #12",
  });
});

test("audit-report can generate registry operations reports", async () => {
  const originalFetch = globalThis.fetch;
  const requests: Array<{ url: URL; body: any }> = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    requests.push({ url, body: JSON.parse(String(init?.body)) });
    return response({
      ...reportBody(),
      report_type: "registry_operations",
      subject_type: "registry",
      subject_id: "registry",
      subject_label: "SpecRegistry",
      markdown: "# Registry Operations Audit\n",
    }, { status: 201 });
  }) as typeof fetch;
  try {
    await runAuditReport({ server: "https://specreg.example.com", registry: true });
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(requests[0].url.pathname, "/api/v1/audit-reports/registry-operations");
  assert.deepEqual(requests[0].body, {});
});
