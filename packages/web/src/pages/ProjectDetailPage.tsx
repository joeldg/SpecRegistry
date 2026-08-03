import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { SpecSummary } from "@specregistry/shared";
import { api, type ProjectRow, type ProjectSectionEvidenceReport } from "../api";
import { StatusBadge, timeAgo } from "../components";

// @spec[SPEC_SECTION_EVIDENCE.md#dashboard]

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<ProjectRow>();
  const [specs, setSpecs] = useState<SpecSummary[]>([]);
  const [sectionEvidence, setSectionEvidence] = useState<ProjectSectionEvidenceReport>();
  const [error, setError] = useState<string>();
  const navigate = useNavigate();

  const reload = useCallback(() => {
    if (!id) return;
    Promise.all([api.project(id), api.specs({ project_id: id }), api.projectSectionEvidence(id)])
      .then(([p, s, evidence]) => {
        setProject(p);
        setSpecs(s);
        setSectionEvidence(evidence);
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

  const evidenceBySpec = useMemo(() => {
    const grouped = new Map<string, ProjectSectionEvidenceReport["sections"]>();
    for (const section of sectionEvidence?.sections ?? []) {
      const current = grouped.get(section.spec_id) ?? [];
      current.push(section);
      grouped.set(section.spec_id, current);
    }
    return grouped;
  }, [sectionEvidence]);

  const unlinkedSections = sectionEvidence?.trace_report
    ? sectionEvidence.sections.filter((section) => section.implementation_status === "unlinked")
    : [];

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
          <div className="label">Sections without code evidence</div>
          <div className="metric">{sectionEvidence?.trace_report ? unlinkedSections.length : "—"}</div>
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
              <th>Code evidence</th>
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
                <td>
                  {!sectionEvidence?.trace_report ? (
                    <span className="faint">No trace report</span>
                  ) : (() => {
                    const sections = evidenceBySpec.get(spec.id) ?? [];
                    const linked = sections.filter((section) => section.implementation_status === "linked").length;
                    const unlinked = sections.length - linked;
                    return sections.length === 0 ? (
                      <span className="faint">No parsed sections</span>
                    ) : unlinked > 0 ? (
                      <span className="badge warning">{unlinked} potentially unused</span>
                    ) : (
                      <span className="badge approved">{linked}/{sections.length} linked</span>
                    );
                  })()}
                </td>
                <td className="faint">{timeAgo(spec.updated_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="section" style={{ marginTop: 24 }}>
        <h2>Potentially unused spec sections</h2>
        {!sectionEvidence?.trace_report ? (
          <p className="faint">No code trace report is available. Run <span className="mono">specreg code-map --report</span> before treating a section as unused.</p>
        ) : unlinkedSections.length === 0 ? (
          <p className="faint">Every parsed section has at least one implementation link in the latest trace report.</p>
        ) : (
          <>
            <p className="faint">These sections have no implementation link in the latest trace report. That is a review signal, not proof that normative or process guidance should be deleted.</p>
            <table className="grid">
              <thead><tr><th>Spec</th><th>Section</th><th>Scope</th><th>Context use</th></tr></thead>
              <tbody>
                {unlinkedSections.map((section) => (
                  <tr key={`${section.spec_id}-${section.section_anchor}`} className="click" onClick={() => navigate(`/specs/${section.spec_id}`)}>
                    <td className="mono">{section.filename}@{section.version}</td>
                    <td><div>{section.section_title}</div><div className="faint mono">#{section.section_anchor}</div></td>
                    <td><StatusBadge status={section.scope} /></td>
                    <td>{section.deliveries > 0 ? `${section.deliveries} deliveries` : <span className="badge warning">not observed</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </>
  );
}
