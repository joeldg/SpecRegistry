import { useEffect, useMemo, useState } from "react";
import type { AuditReportDetail, SpecSummary } from "@specregistry/shared";
import {
  api,
  getAuthor,
  type AgentSessionRow,
  type AuditReportSummaryRow,
  type DependencyMap,
  type EfficacyRun,
  type ManifestDiagnostics,
  type ProjectRow,
  type ProjectTypeWithCount,
  type ReportsOverview,
  type TokenUsageFilters,
  type TokenUsageReport,
} from "../api";
import { Markdown, StatusBadge, timeAgo } from "../components";

type ChartDatum = { label: string; value: number; tone?: "accent" | "green" | "amber" | "red" };
type ReportTab = "overview" | "tokens" | "audits" | "projects" | "diagnostics";

const toneColor: Record<NonNullable<ChartDatum["tone"]>, string> = {
  accent: "#5e6ad2",
  green: "#3fb950",
  amber: "#d29922",
  red: "#f85149",
};

function total(values: Array<{ n: number }>) {
  return values.reduce((sum, row) => sum + Number(row.n ?? 0), 0);
}

function fmtTokens(value: number | null | undefined) {
  const n = Number(value ?? 0);
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(Math.round(n));
}

function BarChart({ data }: { data: ChartDatum[] }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="report-chart" role="img">
      {data.map((d) => (
        <div className="report-bar-row" key={d.label}>
          <div className="report-bar-label">{d.label}</div>
          <div className="report-bar-track">
            <div
              className="report-bar-fill"
              style={{ width: `${Math.max(4, (d.value / max) * 100)}%`, background: toneColor[d.tone ?? "accent"] }}
            />
          </div>
          <div className="report-bar-value mono">{d.value}</div>
        </div>
      ))}
    </div>
  );
}

function DonutChart({ data }: { data: ChartDatum[] }) {
  const sum = data.reduce((acc, item) => acc + item.value, 0);
  let offset = 25;
  return (
    <div className="donut-wrap">
      <svg className="donut" viewBox="0 0 42 42" aria-hidden="true">
        <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="var(--border)" strokeWidth="6" />
        {data.map((d) => {
          const length = sum ? (d.value / sum) * 100 : 0;
          const strokeDasharray = `${length} ${100 - length}`;
          const strokeDashoffset = offset;
          offset -= length;
          return (
            <circle
              key={d.label}
              cx="21"
              cy="21"
              r="15.915"
              fill="transparent"
              stroke={toneColor[d.tone ?? "accent"]}
              strokeWidth="6"
              strokeDasharray={strokeDasharray}
              strokeDashoffset={strokeDashoffset}
            />
          );
        })}
        <text x="21" y="22" textAnchor="middle" className="donut-number">
          {sum}
        </text>
      </svg>
      <div className="legend">
        {data.map((d) => (
          <span key={d.label}>
            <i style={{ background: toneColor[d.tone ?? "accent"] }} /> {d.label} <b>{d.value}</b>
          </span>
        ))}
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const [reportTab, setReportTab] = useState<ReportTab>("overview");
  const [report, setReport] = useState<ReportsOverview>();
  const [specs, setSpecs] = useState<SpecSummary[]>([]);
  const [types, setTypes] = useState<ProjectTypeWithCount[]>([]);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [dependencies, setDependencies] = useState<DependencyMap>();
  const [tokenRoi, setTokenRoi] = useState<Array<{ filename: string; approx_tokens: number; roi_score: number; open_feedback: number }>>([]);
  const [tokenUsage, setTokenUsage] = useState<TokenUsageReport>();
  const [projectTokenUsage, setProjectTokenUsage] = useState<TokenUsageReport>();
  const [auditReports, setAuditReports] = useState<AuditReportSummaryRow[]>([]);
  const [agentSessions, setAgentSessions] = useState<AgentSessionRow[]>([]);
  const [auditTarget, setAuditTarget] = useState<"project" | "spec" | "session" | "release">("project");
  const [selectedAuditProjectId, setSelectedAuditProjectId] = useState("");
  const [selectedAuditSpecId, setSelectedAuditSpecId] = useState("");
  const [selectedAuditSessionId, setSelectedAuditSessionId] = useState("");
  const [releaseAuditLabel, setReleaseAuditLabel] = useState("");
  const [releaseAuditChangedFiles, setReleaseAuditChangedFiles] = useState("");
  const [releaseAuditTests, setReleaseAuditTests] = useState("");
  const [releaseAuditChecks, setReleaseAuditChecks] = useState("");
  const [releaseAuditApprovals, setReleaseAuditApprovals] = useState("");
  const [releaseAuditCommitEvidence, setReleaseAuditCommitEvidence] = useState("");
  const [releaseAuditSpecsLoaded, setReleaseAuditSpecsLoaded] = useState("");
  const [selectedAuditReportId, setSelectedAuditReportId] = useState("");
  const [auditDetail, setAuditDetail] = useState<AuditReportDetail>();
  const [tokenProjectId, setTokenProjectId] = useState("");
  const [tokenDays, setTokenDays] = useState(30);
  const [tokenEventType, setTokenEventType] = useState("");
  const [tokenProvider, setTokenProvider] = useState("");
  const [tokenModel, setTokenModel] = useState("");
  const [tokenSpecId, setTokenSpecId] = useState("");
  const [tokenSection, setTokenSection] = useState("");
  const [tokenSessionId, setTokenSessionId] = useState("");
  const [efficacyTrend, setEfficacyTrend] = useState<Array<EfficacyRun & { filename: string }>>([]);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [specId, setSpecId] = useState("");
  const [projectType, setProjectType] = useState("");
  const [feedbackType, setFeedbackType] = useState<"ambiguity" | "contradiction" | "outdated">("ambiguity");
  const [feedbackText, setFeedbackText] = useState("Synthetic report test: verify this AI feedback appears in reports.");
  const [auditResult, setAuditResult] = useState<string>();
  const [efficacyResult, setEfficacyResult] = useState<EfficacyRun>();
  const [manifestText, setManifestText] = useState("");
  const [manifestRepo, setManifestRepo] = useState("");
  const [manifestResult, setManifestResult] = useState<ManifestDiagnostics>();
  const [busy, setBusy] = useState<string>();

  function reload() {
    setError(undefined);
    Promise.all([
      api.reports(),
      api.specs(),
      api.projectTypes(),
      api.projects(),
      api.dependencyMap(),
      api.tokenRoi(),
      api.efficacyTrends(),
      api.tokenUsageReport({ days: tokenDays }),
      api.auditReports(),
      api.agentSessions(100),
    ])
      .then(([nextReport, nextSpecs, nextTypes, nextProjects, nextDependencies, nextTokenRoi, nextEfficacyTrend, nextTokenUsage, nextAuditReports, nextAgentSessions]) => {
        setReport(nextReport);
        setSpecs(nextSpecs);
        setTypes(nextTypes.filter((t) => t.scope === "project_type"));
        setProjects(nextProjects);
        setAgentSessions(nextAgentSessions);
        setDependencies(nextDependencies);
        setTokenRoi(nextTokenRoi.specs.slice(0, 8));
        setEfficacyTrend(nextEfficacyTrend.runs.slice(-8));
        setTokenUsage(nextTokenUsage);
        setAuditReports(nextAuditReports);
        setSpecId((current) => current || nextSpecs.find((s) => s.status === "published")?.id || nextSpecs[0]?.id || "");
        setSelectedAuditSpecId((current) => current || nextSpecs.find((s) => s.status === "published")?.id || nextSpecs[0]?.id || "");
        setSelectedAuditSessionId((current) => current || nextAgentSessions[0]?.id || "");
        setProjectType((current) => current || nextTypes.find((t) => t.scope === "project_type")?.name || "");
        setSelectedAuditProjectId((current) => current || nextProjects[0]?.id || "");
        setSelectedAuditReportId((current) => current || nextAuditReports[0]?.id || "");
      })
      .catch((e) => setError(e.message));
  }

  useEffect(reload, []);

  const tokenFilters = useMemo<TokenUsageFilters>(
    () => ({
      days: tokenDays,
      project_id: tokenProjectId || undefined,
      event_type: tokenEventType || undefined,
      provider: tokenProvider || undefined,
      model: tokenModel || undefined,
      spec_id: tokenSpecId || undefined,
      section: tokenSection || undefined,
      agent_session_id: tokenSessionId || undefined,
    }),
    [tokenDays, tokenEventType, tokenModel, tokenProjectId, tokenProvider, tokenSection, tokenSessionId, tokenSpecId]
  );

  const tokenQuery = useMemo(() => {
    const params = new URLSearchParams();
    params.set("days", String(tokenFilters.days ?? 30));
    for (const [key, value] of Object.entries(tokenFilters)) {
      if (key === "days" || value == null || value === "") continue;
      params.set(key, String(value));
    }
    return params.toString();
  }, [tokenFilters]);

  useEffect(() => {
    api.tokenUsageReport(tokenFilters)
      .then(setTokenUsage)
      .catch((e) => setError(e.message));
  }, [tokenFilters]);

  useEffect(() => {
    if (!tokenProjectId) {
      setProjectTokenUsage(undefined);
      return;
    }
    api.tokenUsageReport(tokenFilters)
      .then(setProjectTokenUsage)
      .catch((e) => setError(e.message));
  }, [tokenFilters, tokenProjectId]);

  useEffect(() => {
    if (!selectedAuditReportId) {
      setAuditDetail(undefined);
      return;
    }
    api.auditReport(selectedAuditReportId)
      .then(setAuditDetail)
      .catch((e) => setError(e.message));
  }, [selectedAuditReportId]);

  const tokenReportForFilters = projectTokenUsage ?? tokenUsage;
  const tokenEventTypes = useMemo(() => [...new Set((tokenUsage?.by_event_type ?? []).map((row) => row.event_type).filter(Boolean))].sort(), [tokenUsage]);
  const tokenProviders = useMemo(() => [...new Set((tokenReportForFilters?.real_usage ?? []).map((row) => row.provider).filter(Boolean) as string[])].sort(), [tokenReportForFilters]);
  const tokenModels = useMemo(() => [...new Set((tokenReportForFilters?.real_usage ?? []).map((row) => row.model).filter(Boolean) as string[])].sort(), [tokenReportForFilters]);
  const tokenSpecs = useMemo(() => tokenReportForFilters?.by_spec ?? [], [tokenReportForFilters]);
  const tokenSections = useMemo(() => tokenReportForFilters?.by_section ?? [], [tokenReportForFilters]);
  const tokenSessions = useMemo(() => tokenReportForFilters?.sessions ?? [], [tokenReportForFilters]);

  const scopeData = useMemo(() => {
    const byScope = new Map<string, number>();
    for (const row of report?.scopes ?? []) byScope.set(row.scope, (byScope.get(row.scope) ?? 0) + row.n);
    return [
      { label: "Global", value: byScope.get("global") ?? 0, tone: "green" as const },
      { label: "Project types", value: byScope.get("project_type") ?? 0, tone: "accent" as const },
      { label: "Projects", value: byScope.get("project") ?? 0, tone: "amber" as const },
    ];
  }, [report]);

  const feedbackData = useMemo(() => {
    const byType = new Map<string, number>();
    for (const row of report?.feedback_by_type ?? []) byType.set(row.error_type, (byType.get(row.error_type) ?? 0) + row.n);
    return [
      { label: "Ambiguity", value: byType.get("ambiguity") ?? 0, tone: "amber" as const },
      { label: "Contradiction", value: byType.get("contradiction") ?? 0, tone: "red" as const },
      { label: "Outdated", value: byType.get("outdated") ?? 0, tone: "accent" as const },
    ];
  }, [report]);

  async function createFeedback() {
    if (!specId) return;
    setBusy("feedback");
    setError(undefined);
    setNotice(undefined);
    try {
      const spec = specs.find((s) => s.id === specId);
      await api.createFeedback({
        spec_id: specId,
        spec_version: spec?.current_version,
        agent_identifier: "report-test-agent",
        error_type: feedbackType,
        description: feedbackText,
        context_code_snippet: "reports:test-fixture",
      });
      setNotice("Created test AI feedback.");
      reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(undefined);
    }
  }

  async function runAuditTest() {
    if (!projectType) return;
    setBusy("audit");
    setError(undefined);
    setAuditResult(undefined);
    try {
      const result = await api.runAudit({
        project_type: projectType,
        tree: "src/\nsrc/example.ts\n",
        files: [{ path: "src/example.ts", content: "export function handler() { return 'audit-report-test'; }\n" }],
      });
      setAuditResult(`${result.finding_count} findings returned`);
    } catch (e) {
      setAuditResult((e as Error).message);
    } finally {
      setBusy(undefined);
    }
  }

  async function generateProjectAudit() {
    if ((auditTarget === "project" || auditTarget === "release") && !selectedAuditProjectId) return;
    if (auditTarget === "spec" && !selectedAuditSpecId) return;
    if (auditTarget === "session" && !selectedAuditSessionId) return;
    setBusy("audit-report");
    setError(undefined);
    setNotice(undefined);
    try {
      const splitList = (value: string) => value.split(",").map((item) => item.trim()).filter(Boolean);
      const generated = auditTarget === "release"
        ? await api.createReleaseAuditReport({
            project: selectedAuditProjectId,
            label: releaseAuditLabel.trim() || undefined,
            changed_files: splitList(releaseAuditChangedFiles),
            tests: splitList(releaseAuditTests),
            checks: splitList(releaseAuditChecks),
            approvals: splitList(releaseAuditApprovals),
            commit_evidence: releaseAuditCommitEvidence.trim() || undefined,
            specs_loaded: splitList(releaseAuditSpecsLoaded),
          })
        : auditTarget === "session"
          ? await api.createAgentRunAuditReport(selectedAuditSessionId)
          : auditTarget === "spec"
          ? await api.createSpecAuditReport(selectedAuditSpecId)
          : await api.createProjectAuditReport(selectedAuditProjectId);
      setAuditDetail(generated);
      setSelectedAuditReportId(generated.id);
      setNotice(
        auditTarget === "session"
          ? "Agent run audit generated."
          : auditTarget === "release"
            ? "Release/PR audit generated."
          : auditTarget === "spec"
            ? "Spec quality audit generated."
            : "Project governance audit generated."
      );
      setAuditReports(await api.auditReports());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(undefined);
    }
  }

  async function runEfficacyTest() {
    if (!specId) return;
    setBusy("efficacy");
    setError(undefined);
    setEfficacyResult(undefined);
    try {
      const result = await api.runEfficacy(specId, "Explain how an implementation should follow this spec in one paragraph.");
      setEfficacyResult(result);
      reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(undefined);
    }
  }

  async function diagnoseManifest() {
    setBusy("manifest");
    setError(undefined);
    setManifestResult(undefined);
    try {
      const manifest = JSON.parse(manifestText);
      const result = await api.manifestDiagnostics({ manifest, repo: manifestRepo || undefined });
      setManifestResult(result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(undefined);
    }
  }

  const topTypes = [...(report?.project_types ?? [])]
    .sort((a, b) => b.feedback_total + b.pending_reviews - (a.feedback_total + a.pending_reviews))
    .slice(0, 8);
  const projectRisk = [...(report?.projects ?? [])]
    .sort((a, b) => b.outdated_specs + b.open_feedback + b.pending_reviews - (a.outdated_specs + a.open_feedback + a.pending_reviews))
    .slice(0, 10);
  const traceReports = [...(report?.code_trace_reports ?? [])]
    .sort((a, b) => b.drift_score - a.drift_score || a.coverage_ratio - b.coverage_ratio)
    .slice(0, 10);
  const traceSummary = useMemo(() => {
    const rows = report?.code_trace_reports ?? [];
    const governed = rows.reduce((sum, row) => sum + Number(row.governed_entity_count ?? 0), 0);
    const linked = rows.reduce((sum, row) => sum + Number(row.linked_entity_count ?? 0), 0);
    const high = rows.filter((row) => row.drift_severity === "high").length;
    return {
      projects: rows.length,
      coverage: governed ? linked / governed : 0,
      high,
      unmapped: rows.reduce((sum, row) => sum + Number(row.unlinked_entity_count ?? 0), 0),
    };
  }, [report]);
  const auditEvidence = (auditDetail?.evidence ?? {}) as {
    outstanding_actions?: string[];
    specs?: unknown[];
    compliance?: { latest?: { compliant?: boolean; coverage_ratio?: number; drift_score?: number; created_at?: string } | null };
    traceability?: { latest?: { coverage_ratio?: number; drift_score?: number; drift_severity?: string; reported_at?: string } | null };
    feedback?: { open?: unknown[] };
    reviews?: { pending?: unknown[] };
    sections?: unknown[];
    token_usage?: { approx_tokens?: number; projected_tokens?: number; context_events?: number; total_tokens?: number };
    efficacy?: { runs?: unknown[]; improved_count?: number; avg_lift?: number };
    session?: { status?: string; spec_count?: number };
    context?: { events?: unknown[]; projected_tokens?: number; delivered_sections?: number };
    halt_assessment?: { verdict?: string; reason?: string };
    release?: { changed_files?: unknown[] };
    changed_file_mapping?: Array<{ file: string; specs: string[]; link_count: number }>;
    validation?: { tests?: unknown[]; checks?: unknown[]; approvals?: unknown[]; commit_evidence?: string | null };
    rollout_risk?: { level?: string; reasons?: string[] };
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Reports</h1>
          <span className="sub">Granular SDD health by global specs, project type, and project</span>
        </div>
        <button onClick={reload}>Refresh</button>
      </div>
      {error && <div className="error-banner">{error}</div>}
      {notice && <div className="notice-banner">{notice}</div>}

      {report && (
        <>
          <div className="cards">
            <div className="card">
              <div className="metric">{total(report.scopes)}</div>
              <div className="label">Tracked specs</div>
            </div>
            <div className="card">
              <div className="metric">{report.project_types.filter((t) => t.scope === "project_type").length}</div>
              <div className="label">Project types</div>
            </div>
            <div className="card">
              <div className="metric">{report.projects.length}</div>
              <div className="label">Projects</div>
            </div>
            <div className={`card${feedbackData.some((d) => d.value) ? " alert" : ""}`}>
              <div className="metric">{feedbackData.reduce((sum, d) => sum + d.value, 0)}</div>
              <div className="label">AI feedback items</div>
            </div>
          </div>

          <div className="page-tabs" role="tablist" aria-label="Report sections">
            <button className={reportTab === "overview" ? "active" : ""} onClick={() => setReportTab("overview")}>Overview</button>
            <button className={reportTab === "tokens" ? "active" : ""} onClick={() => setReportTab("tokens")}>Token Usage</button>
            <button className={reportTab === "audits" ? "active" : ""} onClick={() => setReportTab("audits")}>Audits</button>
            <button className={reportTab === "projects" ? "active" : ""} onClick={() => setReportTab("projects")}>Projects</button>
            <button className={reportTab === "diagnostics" ? "active" : ""} onClick={() => setReportTab("diagnostics")}>Diagnostics</button>
          </div>

          {reportTab === "overview" && (
            <>
          <div className="report-grid">
            <div className="section report-panel">
              <h2>Spec Scope Mix</h2>
              <DonutChart data={scopeData} />
            </div>
            <div className="section report-panel">
              <h2>AI Feedback Mix</h2>
              <BarChart data={feedbackData} />
            </div>
          </div>

          <div className="report-grid">
            <div className="section report-panel">
              <h2>Dependency Map</h2>
              <div className="cards" style={{ marginBottom: 12 }}>
                <div className="card">
                  <div className="metric">{dependencies?.edges.length ?? 0}</div>
                  <div className="label">Spec links</div>
                </div>
                <div className={`card${dependencies?.unresolved.length ? " alert" : ""}`}>
                  <div className="metric">{dependencies?.unresolved.length ?? 0}</div>
                  <div className="label">Unresolved refs</div>
                </div>
              </div>
              {(dependencies?.edges ?? []).slice(0, 8).map((edge) => (
                <div key={`${edge.from_spec_id}-${edge.to_filename}-${edge.relation}`} className="dim">
                  <span className="mono">{edge.from_filename}</span> {edge.relation.replace("_", " ")}{" "}
                  <span className="mono">{edge.to_filename}</span>
                </div>
              ))}
            </div>
            <div className="section report-panel">
              <h2>Token ROI</h2>
              <BarChart data={tokenRoi.map((row) => ({ label: row.filename, value: Math.max(0, row.roi_score), tone: row.open_feedback ? "amber" : "green" }))} />
            </div>
          </div>

          <div className="section report-panel">
            <h2>Efficacy Trend</h2>
            {efficacyTrend.length === 0 ? (
              <div className="empty">No efficacy runs yet.</div>
            ) : (
              <BarChart
                data={efficacyTrend.map((run) => ({
                  label: `${run.filename} ${new Date(run.created_at).toLocaleDateString()}`,
                  value: Math.max(0, run.score_with - run.score_without),
                  tone: run.improved ? "green" : "amber",
                }))}
              />
            )}
          </div>

          <div className="section report-panel">
            <h2>Code-to-Spec Traceability</h2>
            <div className="cards" style={{ marginBottom: 12 }}>
              <div className="card">
                <div className="metric">{traceSummary.projects}</div>
                <div className="label">Reporting projects</div>
              </div>
              <div className={`card${traceSummary.coverage < 0.5 && traceSummary.projects ? " alert" : ""}`}>
                <div className="metric">{Math.round(traceSummary.coverage * 100)}%</div>
                <div className="label">Code coverage</div>
              </div>
              <div className={`card${traceSummary.high ? " alert" : ""}`}>
                <div className="metric">{traceSummary.high}</div>
                <div className="label">High drift projects</div>
              </div>
              <div className="card">
                <div className="metric">{traceSummary.unmapped}</div>
                <div className="label">Unmapped entities</div>
              </div>
            </div>
            {traceReports.length === 0 ? (
              <div className="empty">No code trace reports yet. Run `specreg code-map --report` from a project.</div>
            ) : (
              <BarChart
                data={traceReports.map((row) => ({
                  label: row.repo,
                  value: Math.round(row.drift_score * 100),
                  tone: row.drift_severity === "high" ? "red" : row.drift_severity === "medium" ? "amber" : "green",
                }))}
              />
            )}
          </div>
            </>
          )}

          {reportTab === "tokens" && (
          <div className="section report-panel">
            <h2>Token Usage</h2>
            <p className="settings-help">
              Projected tokens are estimated from governed spec sections delivered by the registry. Real tokens come from best-effort LLM usage reports.
            </p>
            <div className="form-row" style={{ marginBottom: 12 }}>
              <a
                className="button-link"
                href={`/api/v1/reports/token-usage/export?${tokenQuery}`}
              >
                Export CSV
              </a>
              <a
                className="button-link"
                href={`/api/v1/reports/token-usage/export.json?${tokenQuery}`}
              >
                Export JSON
              </a>
              {tokenProjectId && (
                <button onClick={() => setTokenProjectId("")}>
                  Clear project filter
                </button>
              )}
            </div>
            <div className="form-grid" style={{ marginBottom: 12 }}>
              <label>
                Range
                <select value={tokenDays} onChange={(e) => setTokenDays(Number(e.target.value))}>
                  <option value={7}>7 days</option>
                  <option value={30}>30 days</option>
                  <option value={90}>90 days</option>
                  <option value={365}>1 year</option>
                </select>
              </label>
              <label>
                Event
                <select value={tokenEventType} onChange={(e) => setTokenEventType(e.target.value)}>
                  <option value="">All events</option>
                  {tokenEventTypes.map((eventType) => (
                    <option key={eventType} value={eventType}>{eventType}</option>
                  ))}
                </select>
              </label>
              <label>
                Provider
                <select value={tokenProvider} onChange={(e) => setTokenProvider(e.target.value)}>
                  <option value="">All providers</option>
                  {tokenProviders.map((provider) => (
                    <option key={provider} value={provider}>{provider}</option>
                  ))}
                </select>
              </label>
              <label>
                Model
                <select value={tokenModel} onChange={(e) => setTokenModel(e.target.value)}>
                  <option value="">All models</option>
                  {tokenModels.map((model) => (
                    <option key={model} value={model}>{model}</option>
                  ))}
                </select>
              </label>
              <label>
                Spec
                <select value={tokenSpecId} onChange={(e) => setTokenSpecId(e.target.value)}>
                  <option value="">All specs</option>
                  {tokenSpecs.map((spec) => (
                    <option key={spec.spec_id} value={spec.spec_id}>{spec.filename}</option>
                  ))}
                </select>
              </label>
              <label>
                Section
                <select value={tokenSection} onChange={(e) => setTokenSection(e.target.value)}>
                  <option value="">All sections</option>
                  {tokenSections.slice(0, 100).map((section) => (
                    <option key={`${section.spec_id}-${section.section_anchor}`} value={section.section_anchor}>
                      {section.section_title}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Session
                <select value={tokenSessionId} onChange={(e) => setTokenSessionId(e.target.value)}>
                  <option value="">All sessions</option>
                  {tokenSessions.map((session) => (
                    <option key={session.agent_session_id} value={session.agent_session_id}>{session.task}</option>
                  ))}
                </select>
              </label>
              <label>
                Filters
                <button
                  type="button"
                  onClick={() => {
                    setTokenDays(30);
                    setTokenEventType("");
                    setTokenProvider("");
                    setTokenModel("");
                    setTokenSpecId("");
                    setTokenSection("");
                    setTokenSessionId("");
                  }}
                >
                  Reset filters
                </button>
              </label>
            </div>
            <div className="cards" style={{ marginBottom: 12 }}>
              <div className="card">
                <div className="metric">{fmtTokens(tokenUsage?.projects.reduce((sum, row) => sum + Number(row.projected_tokens ?? 0), 0))}</div>
                <div className="label">Projected context tokens</div>
              </div>
              <div className="card">
                <div className="metric">{fmtTokens(tokenUsage?.projects.reduce((sum, row) => sum + Number(row.real_total_tokens ?? 0), 0))}</div>
                <div className="label">Real LLM tokens</div>
              </div>
              <div className="card">
                <div className="metric">{fmtTokens(tokenUsage?.projects.reduce((sum, row) => sum + Number(row.delivered_sections ?? 0), 0))}</div>
                <div className="label">Delivered sections</div>
              </div>
              <div className="card">
                <div className="metric">{tokenUsage?.tokenizer ?? "chars/4:v1"}</div>
                <div className="label">Estimator</div>
              </div>
            </div>
            {tokenUsage && tokenUsage.trend.length > 0 && (
              <div className="report-grid" style={{ marginBottom: 16 }}>
                <div>
                  <h3>Projected Token Trend</h3>
                  <BarChart
                    data={tokenUsage.trend.slice(-14).map((row) => ({
                      label: row.day.slice(5),
                      value: Number(row.projected_tokens ?? 0),
                      tone: "accent",
                    }))}
                  />
                </div>
                <div>
                  <h3>Real LLM Token Trend</h3>
                  <BarChart
                    data={tokenUsage.trend.slice(-14).map((row) => ({
                      label: row.day.slice(5),
                      value: Number(row.real_total_tokens ?? 0),
                      tone: "green",
                    }))}
                  />
                </div>
              </div>
            )}
            {!tokenUsage || tokenUsage.projects.length === 0 ? (
              <div className="empty">No token usage has been recorded yet. Agent spec reads and searches will populate this report.</div>
            ) : (
              <>
                <table className="grid">
                  <thead>
                    <tr>
                      <th>Project</th>
                      <th>Project type</th>
                      <th>Projected</th>
                      <th>Real</th>
                      <th>Sections</th>
                      <th>Events</th>
                      <th>Last seen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tokenUsage.projects.slice(0, 12).map((row) => (
                      <tr key={row.project_id} className={tokenProjectId === row.project_id ? "selected-row" : ""}>
                        <td>
                          <button className="link-button mono" onClick={() => setTokenProjectId(row.project_id)}>
                            {row.repo}
                          </button>
                        </td>
                        <td>{row.project_type_name}</td>
                        <td className="mono">{fmtTokens(row.projected_tokens)}</td>
                        <td className="mono">{fmtTokens(row.real_total_tokens)}</td>
                        <td className="mono">{fmtTokens(row.delivered_sections)}</td>
                        <td className="mono">{row.context_events}</td>
                        <td className="faint">{row.last_reported_at ? timeAgo(row.last_reported_at) : "never"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {projectTokenUsage && (
                  <div style={{ marginTop: 16 }}>
                    <h3>{projectTokenUsage.projects[0]?.repo ?? "Project"} Token Drilldown</h3>
                    {projectTokenUsage.trend.length > 0 && (
                      <div className="report-grid">
                        <div>
                          <h3>Projected Daily Trend</h3>
                          <BarChart
                            data={projectTokenUsage.trend.slice(-14).map((row) => ({
                              label: row.day.slice(5),
                              value: Number(row.projected_tokens ?? 0),
                              tone: "accent",
                            }))}
                          />
                        </div>
                        <div>
                          <h3>Real Daily Trend</h3>
                          <BarChart
                            data={projectTokenUsage.trend.slice(-14).map((row) => ({
                              label: row.day.slice(5),
                              value: Number(row.real_total_tokens ?? 0),
                              tone: "green",
                            }))}
                          />
                        </div>
                      </div>
                    )}
                    <div className="report-grid">
                      <div>
                        <h3>By Spec</h3>
                        <table className="grid">
                          <thead>
                            <tr>
                              <th>Spec</th>
                              <th>Projected</th>
                              <th>Sections</th>
                              <th>Events</th>
                              <th>Last used</th>
                            </tr>
                          </thead>
                          <tbody>
                            {projectTokenUsage.by_spec.slice(0, 10).map((row) => (
                              <tr key={row.spec_id}>
                                <td className="mono">{row.filename}</td>
                                <td className="mono">{fmtTokens(row.projected_tokens)}</td>
                                <td className="mono">{fmtTokens(row.delivered_sections)}</td>
                                <td className="mono">{row.context_events}</td>
                                <td className="faint">{row.last_delivered_at ? timeAgo(row.last_delivered_at) : "never"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div>
                        <h3>By Retrieval</h3>
                        <BarChart
                          data={projectTokenUsage.by_event_type.slice(0, 8).map((row) => ({
                            label: row.event_type,
                            value: Number(row.projected_tokens ?? 0),
                            tone: "accent",
                          }))}
                        />
                      </div>
                    </div>
                    <h3>Most Expensive Sections</h3>
                    <table className="grid">
                      <thead>
                        <tr>
                          <th>Spec</th>
                          <th>Section</th>
                          <th>Projected</th>
                          <th>Deliveries</th>
                          <th>Last used</th>
                        </tr>
                      </thead>
                      <tbody>
                        {projectTokenUsage.by_section.slice(0, 15).map((row) => (
                          <tr key={`${row.spec_id}-${row.section_anchor}`}>
                            <td className="mono">{row.filename}</td>
                            <td>{row.section_title}</td>
                            <td className="mono">{fmtTokens(row.projected_tokens)}</td>
                            <td className="mono">{row.deliveries}</td>
                            <td className="faint">{row.last_delivered_at ? timeAgo(row.last_delivered_at) : "never"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {projectTokenUsage.real_usage.length > 0 && (
                      <>
                        <h3>Real LLM Usage</h3>
                        <table className="grid">
                          <thead>
                            <tr>
                              <th>Provider</th>
                              <th>Model</th>
                              <th>Route</th>
                              <th>Prompt</th>
                              <th>Completion</th>
                              <th>Total</th>
                              <th>Reports</th>
                            </tr>
                          </thead>
                          <tbody>
                            {projectTokenUsage.real_usage.map((row) => (
                              <tr key={`${row.provider}-${row.model}-${row.route}`}>
                                <td>{row.provider ?? "unknown"}</td>
                                <td className="mono">{row.model ?? "unknown"}</td>
                                <td>{row.route ?? "unspecified"}</td>
                                <td className="mono">{fmtTokens(row.prompt_tokens)}</td>
                                <td className="mono">{fmtTokens(row.completion_tokens)}</td>
                                <td className="mono">{fmtTokens(row.total_tokens)}</td>
                                <td className="mono">{row.reports}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
          )}

          {reportTab === "audits" && (
          <div className="section report-panel">
            <h2>Audit Reports</h2>
            <p className="settings-help">
              Generate deterministic governance reports from registry evidence before adding optional LLM summaries.
            </p>
            <div className="form-row" style={{ marginBottom: 12 }}>
              <select value={auditTarget} onChange={(e) => setAuditTarget(e.target.value as typeof auditTarget)}>
                <option value="project">Project Governance</option>
                <option value="spec">Spec Quality</option>
                <option value="session">Agent Run</option>
                <option value="release">Release/PR</option>
              </select>
              {auditTarget === "project" || auditTarget === "release" ? (
                <select value={selectedAuditProjectId} onChange={(e) => setSelectedAuditProjectId(e.target.value)}>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.repo} · {project.project_type_name}
                    </option>
                  ))}
                </select>
              ) : auditTarget === "spec" ? (
                <select value={selectedAuditSpecId} onChange={(e) => setSelectedAuditSpecId(e.target.value)}>
                  {specs.map((spec) => (
                    <option key={spec.id} value={spec.id}>
                      {spec.filename} · {spec.project_type_name} · v{spec.current_version}
                    </option>
                  ))}
                </select>
              ) : (
                <select value={selectedAuditSessionId} onChange={(e) => setSelectedAuditSessionId(e.target.value)}>
                  {agentSessions.map((session) => (
                    <option key={session.id} value={session.id}>
                      {session.agent_identifier} · {session.status} · {session.task}
                    </option>
                  ))}
                </select>
              )}
              <button
                className="primary"
                disabled={(
                  auditTarget === "project" || auditTarget === "release"
                    ? !selectedAuditProjectId
                    : auditTarget === "spec"
                      ? !selectedAuditSpecId
                      : !selectedAuditSessionId
                ) || busy === "audit-report"}
                onClick={generateProjectAudit}
              >
                {busy === "audit-report" ? "Generating..." : auditTarget === "release" ? "Generate Release Audit" : auditTarget === "session" ? "Generate Agent Audit" : auditTarget === "spec" ? "Generate Spec Audit" : "Generate Project Audit"}
              </button>
              {auditDetail && (
                <a className="button-link" href={`/api/v1/audit-reports/${auditDetail.id}/markdown`}>
                  Export Markdown
                </a>
              )}
            </div>
            {auditTarget === "release" && (
              <div className="report-controls" style={{ marginTop: 8 }}>
                <input
                  value={releaseAuditLabel}
                  onChange={(e) => setReleaseAuditLabel(e.target.value)}
                  placeholder="Label, e.g. PR #42"
                />
                <input
                  value={releaseAuditChangedFiles}
                  onChange={(e) => setReleaseAuditChangedFiles(e.target.value)}
                  placeholder="Changed files, comma-separated"
                />
                <input
                  value={releaseAuditTests}
                  onChange={(e) => setReleaseAuditTests(e.target.value)}
                  placeholder="Tests run, comma-separated"
                />
                <input
                  value={releaseAuditChecks}
                  onChange={(e) => setReleaseAuditChecks(e.target.value)}
                  placeholder="Checks passed, comma-separated"
                />
                <input
                  value={releaseAuditApprovals}
                  onChange={(e) => setReleaseAuditApprovals(e.target.value)}
                  placeholder="Approvals, comma-separated"
                />
                <input
                  value={releaseAuditCommitEvidence}
                  onChange={(e) => setReleaseAuditCommitEvidence(e.target.value)}
                  placeholder="Commit compliance trailer"
                />
                <input
                  value={releaseAuditSpecsLoaded}
                  onChange={(e) => setReleaseAuditSpecsLoaded(e.target.value)}
                  placeholder="Specs loaded, comma-separated"
                />
              </div>
            )}
            {auditTarget === "project" && projects.length === 0 ? (
              <div className="empty">No projects have reported manifests yet. Run `specreg init` or `specreg check` from a project first.</div>
            ) : auditTarget === "release" && projects.length === 0 ? (
              <div className="empty">No projects have reported manifests yet. Run `specreg init` or `specreg check` from a project first.</div>
            ) : auditTarget === "session" && agentSessions.length === 0 ? (
              <div className="empty">No agent sessions have been recorded yet. Agents should call `begin_task` before governed work.</div>
            ) : (
              <div className="report-grid">
                <div>
                  <h3>History</h3>
                  {auditReports.length === 0 ? (
                    <div className="empty">No audit reports have been generated yet.</div>
                  ) : (
                    <table className="grid">
                      <thead>
                        <tr>
                          <th>Subject</th>
                          <th>Type</th>
                          <th>Status</th>
                          <th>Generated</th>
                        </tr>
                      </thead>
                      <tbody>
                        {auditReports.map((audit) => (
                          <tr key={audit.id} className={selectedAuditReportId === audit.id ? "selected-row" : ""}>
                            <td>
                              <button className="link-button mono" onClick={() => setSelectedAuditReportId(audit.id)}>
                                {audit.subject_label}
                              </button>
                              <div className="faint">{audit.summary}</div>
                            </td>
                            <td><StatusBadge status={audit.report_type} /></td>
                            <td><StatusBadge status={audit.status} /></td>
                            <td className="faint">{timeAgo(audit.created_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
                <div>
                  {!auditDetail ? (
                    <div className="empty">Select a report or generate a new audit.</div>
                  ) : (
                    <>
                      <div className="cards" style={{ marginBottom: 12 }}>
                        <div className={`card${auditDetail.status !== "pass" ? " alert" : ""}`}>
                          <div className="label">Status</div>
                          <StatusBadge status={auditDetail.status} />
                        </div>
                        {auditDetail.report_type === "release" ? (
                          <>
                            <div className="card">
                              <div className="label">Changed files</div>
                              <div className="metric">{auditEvidence.release?.changed_files?.length ?? 0}</div>
                            </div>
                            <div className="card">
                              <div className="label">Mapped files</div>
                              <div className="metric">{auditEvidence.changed_file_mapping?.filter((row) => row.specs.length > 0).length ?? 0}</div>
                            </div>
                          </>
                        ) : auditDetail.report_type === "agent_run" ? (
                          <>
                            <div className="card">
                              <div className="label">Session</div>
                              <StatusBadge status={auditEvidence.session?.status ?? "unknown"} />
                            </div>
                            <div className="card">
                              <div className="label">Context</div>
                              <div className="metric">{auditEvidence.context?.events?.length ?? 0}</div>
                            </div>
                          </>
                        ) : auditDetail.report_type === "spec_quality" ? (
                          <>
                            <div className="card">
                              <div className="label">Sections</div>
                              <div className="metric">{auditEvidence.sections?.length ?? 0}</div>
                            </div>
                            <div className="card">
                              <div className="label">Spec tokens</div>
                              <div className="metric">{fmtTokens(auditEvidence.token_usage?.approx_tokens)}</div>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="card">
                              <div className="label">Specs</div>
                              <div className="metric">{auditEvidence.specs?.length ?? 0}</div>
                            </div>
                            <div className="card">
                              <div className="label">Compliance</div>
                              <div className="mono">
                                {auditEvidence.compliance?.latest
                                  ? `${Math.round(Number(auditEvidence.compliance.latest.coverage_ratio ?? 0) * 100)}% / ${Math.round(Number(auditEvidence.compliance.latest.drift_score ?? 0) * 100)}% drift`
                                  : "missing"}
                              </div>
                            </div>
                          </>
                        )}
                        <div className="card">
                          <div className="label">Actions</div>
                          <div className="metric">{auditEvidence.outstanding_actions?.length ?? 0}</div>
                        </div>
                      </div>
                      {(auditEvidence.outstanding_actions?.length ?? 0) > 0 && (
                        <div style={{ marginBottom: 12 }}>
                          <h3>Outstanding Actions</h3>
                          <ul>
                            {auditEvidence.outstanding_actions?.map((action) => (
                              <li key={action}>{action}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <div className="cards" style={{ marginBottom: 12 }}>
                        {auditDetail.report_type === "release" ? (
                          <>
                            <div className="card">
                              <div className="label">Validation</div>
                              <div className="mono">{auditEvidence.validation?.tests?.length ?? 0} tests / {auditEvidence.validation?.checks?.length ?? 0} checks / {auditEvidence.validation?.approvals?.length ?? 0} approvals</div>
                            </div>
                            <div className="card">
                              <div className="label">Rollout risk</div>
                              <StatusBadge status={auditEvidence.rollout_risk?.level ?? "unknown"} />
                            </div>
                          </>
                        ) : auditDetail.report_type === "agent_run" ? (
                          <>
                            <div className="card">
                              <div className="label">Tokens</div>
                              <div className="metric">{fmtTokens(auditEvidence.token_usage?.total_tokens)}</div>
                            </div>
                            <div className="card">
                              <div className="label">Halt</div>
                              <StatusBadge status={auditEvidence.halt_assessment?.verdict ?? "unknown"} />
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="card">
                              <div className="label">Open feedback</div>
                              <div className="metric">{auditEvidence.feedback?.open?.length ?? 0}</div>
                            </div>
                            <div className="card">
                              <div className="label">Pending reviews</div>
                              <div className="metric">{auditEvidence.reviews?.pending?.length ?? 0}</div>
                            </div>
                          </>
                        )}
                        {auditDetail.report_type === "agent_run" || auditDetail.report_type === "release" ? null : auditDetail.report_type === "spec_quality" ? (
                          <div className="card">
                            <div className="label">Efficacy</div>
                            <div className="mono">{auditEvidence.efficacy?.runs?.length ?? 0} runs / lift {auditEvidence.efficacy?.avg_lift ?? 0}</div>
                          </div>
                        ) : (
                          <div className="card">
                            <div className="label">Code trace</div>
                            <div className="mono">
                              {auditEvidence.traceability?.latest
                                ? `${Math.round(Number(auditEvidence.traceability.latest.coverage_ratio ?? 0) * 100)}% / ${auditEvidence.traceability.latest.drift_severity ?? "none"}`
                                : "missing"}
                            </div>
                          </div>
                        )}
                      </div>
                      <Markdown content={auditDetail.markdown} />
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
          )}

          {reportTab === "projects" && (
            <>
          <div className="section">
            <h2>Project Type Reports</h2>
            <table className="grid">
              <thead>
                <tr>
                  <th>Project type</th>
                  <th>Specs</th>
                  <th>Projects</th>
                  <th>Usage</th>
                  <th>Open feedback</th>
                  <th>Pending reviews</th>
                  <th>Efficacy</th>
                  <th>Stale</th>
                </tr>
              </thead>
              <tbody>
                {topTypes.map((t) => (
                  <tr key={t.id}>
                    <td>{t.name}</td>
                    <td className="mono">{t.published_specs}/{t.spec_count} published · {t.project_spec_count} project</td>
                    <td className="mono">{t.project_count}</td>
                    <td className="mono">
                      {(t.usage.agent_read ?? 0) + (t.usage.search ?? 0) + (t.usage.download ?? 0)} events
                    </td>
                    <td><StatusBadge status={t.open_feedback ? "open" : "resolved"} /> <span className="mono">{t.open_feedback}</span></td>
                    <td><StatusBadge status={t.pending_reviews ? "pending" : "approved"} /> <span className="mono">{t.pending_reviews}</span></td>
                    <td className="mono">{t.efficacy_improved}/{t.efficacy_runs} improved</td>
                    <td className="mono">{t.stale_specs}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="section">
            <h2>Project Reports</h2>
            {projectRisk.length === 0 ? (
              <div className="empty">No projects have reported manifests yet.</div>
            ) : (
              <table className="grid">
                <thead>
                  <tr>
                    <th>Project</th>
                    <th>Project type</th>
                    <th>Reported specs</th>
                    <th>Project specs</th>
                    <th>Outdated</th>
                    <th>Code coverage</th>
                    <th>Code drift</th>
                    <th>Open feedback</th>
                    <th>Pending reviews</th>
                    <th>Last seen</th>
                  </tr>
                </thead>
                <tbody>
                  {projectRisk.map((p) => (
                    <tr key={p.id}>
                      <td className="mono">{p.repo}</td>
                      <td>{p.project_type_name}</td>
                      <td className="mono">{p.reported_specs}</td>
                      <td className="mono">{p.project_specs}</td>
                      <td><StatusBadge status={p.outdated_specs ? "pending" : "approved"} /> <span className="mono">{p.outdated_specs}</span></td>
                      <td className="mono">
                        {p.code_trace_report_id ? `${Math.round(Number(p.code_coverage_ratio ?? 0) * 100)}% (${p.code_linked_entity_count ?? 0}/${p.code_governed_entity_count ?? 0})` : "not reported"}
                      </td>
                      <td>
                        {p.code_trace_report_id ? (
                          <>
                            <StatusBadge status={p.code_drift_severity ?? "none"} /> <span className="mono">{Number(p.code_drift_score ?? 0).toFixed(2)}</span>
                          </>
                        ) : (
                          <span className="faint">none</span>
                        )}
                      </td>
                      <td><StatusBadge status={p.open_feedback ? "open" : "resolved"} /> <span className="mono">{p.open_feedback}</span></td>
                      <td><StatusBadge status={p.pending_reviews ? "pending" : "approved"} /> <span className="mono">{p.pending_reviews}</span></td>
                      <td className="faint">{timeAgo(p.last_seen_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
            </>
          )}

          {reportTab === "diagnostics" && (
          <div className="section report-panel">
            <h2>Manifest Drift Diagnostics</h2>
            <div className="form-row">
              <input
                value={manifestRepo}
                onChange={(e) => setManifestRepo(e.target.value)}
                placeholder="Optional repo override, e.g. github.com/org/repo"
              />
              <button className="primary" disabled={!manifestText.trim() || busy === "manifest"} onClick={diagnoseManifest}>
                {busy === "manifest" ? "Checking..." : "Check manifest"}
              </button>
            </div>
            <textarea
              value={manifestText}
              onChange={(e) => setManifestText(e.target.value)}
              rows={8}
              placeholder="Paste specs/.specregistry.json"
              style={{ marginTop: 10 }}
            />
            {manifestResult && (
              <>
                <div className="cards" style={{ marginTop: 12 }}>
                  <div className={`card${manifestResult.drift ? " alert" : ""}`}>
                    <div className="label">Drift</div>
                    <div><StatusBadge status={manifestResult.drift ? "pending" : "approved"} /> {manifestResult.project_type}</div>
                    <div className="dim">{manifestResult.project ?? "No project repo supplied"}</div>
                  </div>
                  <div className="card">
                    <div className="label">Up to date</div>
                    <div className="mono">{manifestResult.up_to_date.length}/{manifestResult.latest_count}</div>
                  </div>
                  <div className={`card${manifestResult.breaking_count ? " alert" : ""}`}>
                    <div className="label">Breaking drift</div>
                    <div className="mono">{manifestResult.breaking_count}</div>
                  </div>
                  <div className="card">
                    <div className="label">Local only</div>
                    <div className="mono">{manifestResult.local_only_count}</div>
                  </div>
                </div>
                <table className="grid" style={{ marginTop: 12 }}>
                  <thead>
                    <tr>
                      <th>Spec</th>
                      <th>Local</th>
                      <th>Registry</th>
                      <th>Severity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {manifestResult.outdated.map((row) => (
                      <tr key={row.filename}>
                        <td className="mono">{row.filename}</td>
                        <td className="mono">{row.local_version}</td>
                        <td className="mono">{row.latest_version}</td>
                        <td><StatusBadge status={row.severity} /> {!row.within_pin && <span className="badge rejected">outside pin</span>}</td>
                      </tr>
                    ))}
                    {manifestResult.missing_locally.map((row) => (
                      <tr key={row.filename}>
                        <td className="mono">{row.filename}</td>
                        <td className="faint">missing</td>
                        <td className="mono">{row.latest_version}</td>
                        <td><StatusBadge status="pending" /></td>
                      </tr>
                    ))}
                    {manifestResult.not_on_server.map((filename) => (
                      <tr key={filename}>
                        <td className="mono">{filename}</td>
                        <td className="faint">local</td>
                        <td className="faint">not governed</td>
                        <td><StatusBadge status="draft" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
          )}

          {reportTab === "projects" && (
          <div className="section">
            <h2>Global Spec Reports</h2>
            <table className="grid">
              <thead>
                <tr>
                  <th>Spec</th>
                  <th>Status</th>
                  <th>Feedback</th>
                  <th>Reviews</th>
                  <th>Efficacy</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {report.global_specs.map((s) => (
                  <tr key={s.id}>
                    <td className="mono">{s.filename}</td>
                    <td><StatusBadge status={s.status} /></td>
                    <td className="mono">{s.open_feedback} open / {s.feedback_total} total</td>
                    <td className="mono">{s.pending_reviews} pending</td>
                    <td className="mono">{s.efficacy_improved}/{s.efficacy_runs} improved</td>
                    <td className="faint">{timeAgo(s.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}

          {reportTab === "diagnostics" && (
          <div className="section report-panel">
            <h2>AI Reporting Test Bench</h2>
            <div className="form-row">
              <select value={specId} onChange={(e) => setSpecId(e.target.value)}>
                {specs.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.filename} · {s.project_type_name} · v{s.current_version}
                  </option>
                ))}
              </select>
              <select value={feedbackType} onChange={(e) => setFeedbackType(e.target.value as typeof feedbackType)}>
                <option value="ambiguity">Ambiguity</option>
                <option value="contradiction">Contradiction</option>
                <option value="outdated">Outdated</option>
              </select>
              <button className="primary" disabled={!specId || busy === "feedback"} onClick={createFeedback}>
                {busy === "feedback" ? "Creating..." : "Create test feedback"}
              </button>
              <button disabled={!specId || busy === "efficacy"} onClick={runEfficacyTest}>
                {busy === "efficacy" ? "Running..." : "Run efficacy test"}
              </button>
            </div>
            <textarea value={feedbackText} onChange={(e) => setFeedbackText(e.target.value)} rows={3} />
            <div className="form-row" style={{ marginTop: 10 }}>
              <select value={projectType} onChange={(e) => setProjectType(e.target.value)}>
                {types.map((t) => (
                  <option key={t.id} value={t.name}>{t.name}</option>
                ))}
              </select>
              <button disabled={!projectType || busy === "audit"} onClick={runAuditTest}>
                {busy === "audit" ? "Running..." : "Run audit smoke test"}
              </button>
              <span className="faint">Actor: {getAuthor()}</span>
            </div>
            {auditResult && <div className="mono dim">Audit result: {auditResult}</div>}
            {efficacyResult && (
              <div className="mono dim">
                Efficacy: with {efficacyResult.score_with}, without {efficacyResult.score_without}, model {efficacyResult.model}
              </div>
            )}
          </div>
          )}
        </>
      )}
    </>
  );
}
