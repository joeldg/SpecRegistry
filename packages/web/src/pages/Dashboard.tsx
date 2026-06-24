import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { SpecSummary } from "@specregistry/shared";
import { api, type AnalyticsSummary, type FeedbackRow, type ReviewRow, type ReviewSlaSummary } from "../api";
import { StatusBadge, timeAgo } from "../components";

export default function Dashboard() {
  const [specs, setSpecs] = useState<SpecSummary[]>([]);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [feedback, setFeedback] = useState<FeedbackRow[]>([]);
  const [usage, setUsage] = useState<AnalyticsSummary>();
  const [sla, setSla] = useState<ReviewSlaSummary>();
  const [error, setError] = useState<string>();
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([api.specs(), api.reviews("pending"), api.feedback("open"), api.analytics(), api.reviewSla()])
      .then(([s, r, f, u, sl]) => {
        setSpecs(s);
        setReviews(r);
        setFeedback(f);
        setUsage(u);
        setSla(sl);
      })
      .catch((e) => setError(e.message));
  }, []);

  const published = specs.filter((s) => s.status === "published").length;

  return (
    <>
      <div className="page-head">
        <h1>Dashboard</h1>
        <span className="sub">Registry health at a glance</span>
      </div>
      {error && <div className="error-banner">{error}</div>}

      <div className="cards">
        <div className="card">
          <div className="metric">{specs.length}</div>
          <div className="label">Specifications</div>
        </div>
        <div className="card">
          <div className="metric">{published}</div>
          <div className="label">Published</div>
        </div>
        <div className={`card${reviews.length ? " alert" : ""}`}>
          <div className="metric">{reviews.length}</div>
          <div className="label">Pending reviews</div>
        </div>
        <div className={`card${sla?.breached_count ? " alert" : ""}`}>
          <div className="metric">{sla?.oldest_age_hours ?? 0}h</div>
          <div className="label">Oldest pending review</div>
        </div>
        <div className={`card${feedback.length ? " alert" : ""}`}>
          <div className="metric">{feedback.length}</div>
          <div className="label">Open AI feedback alerts</div>
        </div>
      </div>

      <div className="section">
        <h2>Developer Quickstart</h2>
        <div className="card" style={{ display: "flex", flexDirection: "column", gap: 12, background: "linear-gradient(135deg, var(--bg-raised) 0%, rgba(94, 106, 210, 0.04) 100%)", border: "1px solid var(--border)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <div>
              <h3 style={{ margin: "0 0 4px 0", fontSize: 13, textTransform: "none", letterSpacing: "normal", color: "var(--text)" }}>Install SpecRegistry CLI</h3>
              <p className="dim" style={{ margin: 0, fontSize: 12 }}>Install the command-line tool directly from this server to initialize repositories and check spec drift.</p>
            </div>
            <a className="btn primary" href="/api/v1/cli/download" style={{ textDecoration: "none" }}>
              Download CLI Tarball
            </a>
          </div>
          
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span className="faint" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.5px" }}>Quick Install Command</span>
            <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
              <input 
                type="text" 
                readOnly 
                value={`npm install -g ${window.location.origin}/api/v1/cli/download`} 
                style={{ flex: 1, fontFamily: "var(--mono)", fontSize: 12, background: "var(--bg)", border: "1px solid var(--border-strong)", borderRadius: 6, padding: "6px 10px" }}
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(`npm install -g ${window.location.origin}/api/v1/cli/download`);
                  alert("Copied to clipboard!");
                }}
                style={{ whiteSpace: "nowrap" }}
              >
                Copy
              </button>
            </div>
          </div>
        </div>
      </div>

      {usage && (
        <div className="section">
          <h2>Usage — last {usage.window_days} days</h2>
          <div className="cards">
            <div className="card">
              <div className="metric">{usage.events.download ?? 0}</div>
              <div className="label">CLI spec pulls</div>
            </div>
            <div className="card">
              <div className="metric">{usage.events.agent_read ?? 0}</div>
              <div className="label">Agent spec reads</div>
            </div>
            <div className="card">
              <div className="metric">{usage.events.search ?? 0}</div>
              <div className="label">Spec searches</div>
            </div>
            <div className="card">
              <div className="metric">{usage.events.sync_check ?? 0}</div>
              <div className="label">Drift checks</div>
            </div>
          </div>
          {usage.stale_specs.length > 0 && (
            <div className="card" style={{ borderColor: "rgba(210, 153, 34, 0.4)" }}>
              <div className="label" style={{ marginBottom: 6 }}>
                Stale specs (published, untouched for 90+ days)
              </div>
              {usage.stale_specs.map((s) => (
                <div key={s.id}>
                  <span
                    className="mono"
                    style={{ cursor: "pointer", textDecoration: "underline" }}
                    onClick={() => navigate(`/specs/${s.id}`)}
                  >
                    {s.filename}
                  </span>{" "}
                  <span className="dim">
                    {s.project_type_name} · v{s.current_version} · updated {timeAgo(s.updated_at)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="section">
        <h2>Open AI feedback</h2>
        {feedback.length === 0 ? (
          <div className="empty">No open alerts. Agents are happy.</div>
        ) : (
          <table className="grid">
            <thead>
              <tr>
                <th>Spec</th>
                <th>Version</th>
                <th>Type</th>
                <th>Agent</th>
                <th>Description</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {feedback.map((f) => (
                <tr key={f.id} className="click" onClick={() => navigate(`/specs/${f.spec_id}`)}>
                  <td className="mono">{f.filename}</td>
                  <td className="mono">{f.spec_version}</td>
                  <td>
                    <StatusBadge status={f.error_type} />
                  </td>
                  <td className="mono dim">{f.agent_identifier}</td>
                  <td className="feedback-desc dim">{f.description}</td>
                  <td className="faint">{timeAgo(f.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="section">
        <h2>Pending reviews</h2>
        {sla && sla.pending_count > 0 && (
          <div className={`card${sla.breached_count || sla.warning_count ? " alert" : ""}`} style={{ marginBottom: 12 }}>
            <div className="label">Review SLA</div>
            <div>
              {sla.breached_count} breached · {sla.warning_count} warning · thresholds {sla.warn_hours}h/{sla.breach_hours}h
            </div>
          </div>
        )}
        {reviews.length === 0 ? (
          <div className="empty">Review queue is clear.</div>
        ) : (
          <table className="grid">
            <thead>
              <tr>
                <th>Spec</th>
                <th>Project type</th>
                <th>Delta</th>
                <th>Proposed by</th>
                <th>Summary</th>
                <th>SLA</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {reviews.map((r) => {
                const row = sla?.queue.find((item) => item.id === r.id);
                return (
                <tr key={r.id} className="click" onClick={() => navigate(`/reviews/${r.id}`)}>
                  <td className="mono">{r.filename}</td>
                  <td>{r.project_type_name}</td>
                  <td className="mono">{r.version_delta}</td>
                  <td>{r.proposed_by}</td>
                  <td className="dim">{r.summary ?? "—"}</td>
                  <td>
                    <StatusBadge status={row?.sla_status ?? "ok"} />
                    {row ? <span className="faint"> {row.age_hours}h</span> : null}
                  </td>
                  <td className="faint">{timeAgo(r.created_at)}</td>
                </tr>
              );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
