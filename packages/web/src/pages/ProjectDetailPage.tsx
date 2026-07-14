import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { SpecSummary } from "@specregistry/shared";
import { api, type ProjectRow } from "../api";
import { StatusBadge, timeAgo } from "../components";

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<ProjectRow>();
  const [specs, setSpecs] = useState<SpecSummary[]>([]);
  const [error, setError] = useState<string>();
  const navigate = useNavigate();

  const reload = useCallback(() => {
    if (!id) return;
    Promise.all([api.project(id), api.specs({ project_id: id })])
      .then(([p, s]) => {
        setProject(p);
        setSpecs(s);
      })
      .catch((e) => setError(e.message));
  }, [id]);

  useEffect(reload, [reload]);

  const grouped = useMemo(() => {
    const order = ["global", "project_type", "project"];
    return [...specs].sort((a, b) => {
      const scopeDelta = order.indexOf(a.effective_scope) - order.indexOf(b.effective_scope);
      return scopeDelta || a.filename.localeCompare(b.filename);
    });
  }, [specs]);

  if (!project) {
    return error ? <div className="error-banner">{error}</div> : <p className="dim">Loading…</p>;
  }

  return (
    <>
      <div className="page-head">
        <h1>
          <span className="mono">{project.repo}</span>
        </h1>
        <span className="sub">Inherits {project.project_type_name}</span>
      </div>
      {error && <div className="error-banner">{error}</div>}

      <div className="toolbar">
        <button className="primary" onClick={() => navigate(`/specs?project_id=${encodeURIComponent(project.id)}`)}>
          Add project spec
        </button>
        <button onClick={() => navigate("/projects")}>
          Back to projects
        </button>
      </div>

      <div className="metrics">
        <div className="metric-card">
          <div className="label">Baseline</div>
          <div className="metric">{project.project_type_name}</div>
        </div>
        <div className="metric-card">
          <div className="label">Project specs</div>
          <div className="metric">{project.project_spec_count}</div>
        </div>
        <div className="metric-card">
          <div className="label">Outdated</div>
          <div className="metric">{project.outdated_count}</div>
        </div>
        <div className="metric-card">
          <div className="label">Last seen</div>
          <div className="metric" style={{ fontSize: 16 }}>{timeAgo(project.last_seen_at)}</div>
        </div>
      </div>

      <div className="section" style={{ marginTop: 24 }}>
        <h2>Governed Specs</h2>
        <table className="grid">
          <thead>
            <tr>
              <th>Scope</th>
              <th>File</th>
              <th>Version</th>
              <th>Status</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {grouped.map((spec) => (
              <tr key={spec.id} className="click" onClick={() => navigate(`/specs/${spec.id}`)}>
                <td>
                  <StatusBadge status={spec.effective_scope} />
                </td>
                <td className="mono">{spec.filename}</td>
                <td className="mono">{spec.current_version}</td>
                <td>
                  <StatusBadge status={spec.status} />
                </td>
                <td className="faint">{timeAgo(spec.updated_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
