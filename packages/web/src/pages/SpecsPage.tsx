import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import type { Scope, SpecSummary, SpecTemplate } from "@specregistry/shared";
import { api, getAuthor, type ProjectRow, type ProjectTypeWithCount } from "../api";
import { Markdown, StatusBadge, timeAgo } from "../components";

type DeletedSpec = SpecSummary & { deleted_at: string };
type StatusFilter = "all" | "draft" | "pending_review" | "published";

/** The three governed scope layers, top to bottom. */
const SCOPE_ORDER: Scope[] = ["global", "project_type", "project"];
const SCOPE_META: Record<Scope, { label: string; hint: string; badge: string }> = {
  global: {
    label: "Global",
    hint: "Organization-wide specs that apply to every project of every type.",
    badge: "global",
  },
  project_type: {
    label: "Project types",
    hint: "Baseline specs that apply to every project of a given type.",
    badge: "project_type",
  },
  project: {
    label: "Projects",
    hint: "Specs that apply only to a single project repository.",
    badge: "project",
  },
};

function attentionCount(s: SpecSummary): number {
  return (s.open_feedback_count ?? 0) + (s.pending_review_count ?? 0);
}

export default function SpecsPage({ embedded = false }: { embedded?: boolean } = {}) {
  const [specs, setSpecs] = useState<SpecSummary[]>([]);
  const [types, setTypes] = useState<ProjectTypeWithCount[]>([]);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [templates, setTemplates] = useState<SpecTemplate[]>([]);
  const [error, setError] = useState<string>();
  const [creating, setCreating] = useState(false);
  const [newTypeId, setNewTypeId] = useState("");
  const [newProjectId, setNewProjectId] = useState("");
  const [newFilename, setNewFilename] = useState("");
  const [assistGuidance, setAssistGuidance] = useState("");
  const [assistContent, setAssistContent] = useState("");
  const [assistModel, setAssistModel] = useState("");
  const [assistProvider, setAssistProvider] = useState("");
  const [assisting, setAssisting] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);
  const [deletedSpecs, setDeletedSpecs] = useState<DeletedSpec[]>([]);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Browse controls: faceted filter bar (Option B) over scope-first grouping (Option A).
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [scopeFilter, setScopeFilter] = useState<Scope | "all">("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [attentionOnly, setAttentionOnly] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<Scope, boolean>>({
    global: false,
    project_type: false,
    project: false,
  });

  function reload() {
    const projectId = searchParams.get("project_id") ?? "";
    Promise.all([api.specs(projectId ? { project_id: projectId } : undefined), api.projectTypes(), api.projects(), api.templates()])
      .then(([s, t, p, tpl]) => {
        setSpecs(s);
        setTypes(t);
        setProjects(p);
        setTemplates(tpl);
        if (projectId) {
          setNewProjectId(projectId);
          const project = p.find((item) => item.id === projectId);
          if (project) setNewTypeId(project.project_type_id);
        } else if (!newTypeId && t.length) {
          const firstBaseline = t.find((item) => item.scope === "project_type") ?? t[0];
          setNewTypeId(firstBaseline.id);
        }
      })
      .catch((e) => setError(e.message));
  }

  useEffect(reload, [searchParams]);

  // Keep facet selections coherent with the active scope: a scope that hides the
  // type/project facet also clears any stale selection there.
  useEffect(() => {
    if (scopeFilter === "global" || scopeFilter === "project") setTypeFilter("all");
    if (scopeFilter === "global" || scopeFilter === "project_type") setProjectFilter("all");
  }, [scopeFilter]);

  function loadDeleted() {
    api.deletedSpecs().then(setDeletedSpecs).catch((e) => setError(e.message));
  }

  // Facet option lists derived from the loaded specs, so options always reflect
  // what is actually browsable. Project-type options come from project_type and
  // project specs; project options come from project specs.
  const typeOptions = useMemo(() => {
    const names = new Set<string>();
    for (const s of specs) {
      if (s.effective_scope === "project_type") names.add(s.project_type_name);
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [specs]);

  const projectOptions = useMemo(() => {
    const map = new Map<string, string>(); // id -> name
    for (const s of specs) {
      if (s.effective_scope === "project" && s.project_id) map.set(s.project_id, s.project_name ?? s.project_id);
    }
    return [...map.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [specs]);

  // Apply all facet filters once, before grouping.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return specs.filter((s) => {
      if (scopeFilter !== "all" && s.effective_scope !== scopeFilter) return false;
      if (typeFilter !== "all" && !(s.effective_scope === "project_type" && s.project_type_name === typeFilter)) return false;
      if (projectFilter !== "all" && !(s.effective_scope === "project" && s.project_id === projectFilter)) return false;
      if (statusFilter !== "all" && s.status !== statusFilter) return false;
      if (attentionOnly && attentionCount(s) === 0) return false;
      if (q) {
        const hay = `${s.filename} ${s.project_type_name} ${s.project_name ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [specs, query, statusFilter, scopeFilter, typeFilter, projectFilter, attentionOnly]);

  // Group by scope layer, then sub-group within each layer (project_type by
  // type name, project by repo, global flat). Attention rows float to the top.
  const byScope = useMemo(() => {
    const sortRows = (rows: SpecSummary[]) =>
      [...rows].sort((a, b) => {
        const d = attentionCount(b) - attentionCount(a);
        if (d !== 0) return d;
        return a.filename.localeCompare(b.filename);
      });

    const build = (scope: Scope) => {
      const rows = filtered.filter((s) => s.effective_scope === scope);
      const subMap = new Map<string, SpecSummary[]>();
      for (const s of rows) {
        const key = scope === "project" ? s.project_name ?? "(unknown project)" : scope === "project_type" ? s.project_type_name : "";
        if (!subMap.has(key)) subMap.set(key, []);
        subMap.get(key)!.push(s);
      }
      const subgroups = [...subMap.entries()]
        .map(([name, r]) => ({ name, rows: sortRows(r) }))
        .sort((a, b) => a.name.localeCompare(b.name));
      return {
        scope,
        total: rows.length,
        attention: rows.reduce((n, s) => n + (attentionCount(s) > 0 ? 1 : 0), 0),
        subgroups,
      };
    };

    return SCOPE_ORDER.map(build);
  }, [filtered]);

  const totalShown = filtered.length;
  const activeFilters =
    query.trim() !== "" ||
    statusFilter !== "all" ||
    scopeFilter !== "all" ||
    typeFilter !== "all" ||
    projectFilter !== "all" ||
    attentionOnly;

  function clearFilters() {
    setQuery("");
    setStatusFilter("all");
    setScopeFilter("all");
    setTypeFilter("all");
    setProjectFilter("all");
    setAttentionOnly(false);
  }

  async function createSpec() {
    if (!newFilename.trim()) return;
    const filename = newFilename.trim();
    const template = templates.find(
      (t) => t.filename.toLowerCase() === filename.toLowerCase() && t.content_template.trim()
    );
    try {
      const spec = await api.createSpec({
        project_type_id: newTypeId,
        project_id: newProjectId || undefined,
        filename,
        content: assistContent.trim() || template?.content_template || `# ${filename.replace(/\.md$/i, "")}\n\n_Draft._\n`,
        updated_by: getAuthor(),
      });
      navigate(`/specs/${spec.id}`);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function generateAssistedDraft() {
    if (!newTypeId || !newFilename.trim() || !assistGuidance.trim()) return;
    setAssisting(true);
    setError(undefined);
    try {
      const result = await api.newSpecAssist({
        project_type_id: newTypeId,
        project_id: newProjectId || undefined,
        filename: newFilename.trim(),
        guidance: assistGuidance.trim(),
        current_content: assistContent || undefined,
      });
      setAssistContent(result.content);
      setAssistModel(result.model);
      setAssistProvider(result.provider);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAssisting(false);
    }
  }

  function specRow(s: SpecSummary) {
    const attention = attentionCount(s);
    return (
      <tr key={s.id} className="click" onClick={() => navigate(`/specs/${s.id}`)}>
        <td className="mono">{s.filename}</td>
        <td>
          <span className={`badge ${SCOPE_META[s.effective_scope].badge}`}>{SCOPE_META[s.effective_scope].label}</span>
        </td>
        <td>{s.effective_scope === "project" ? <Link to={`/projects/${s.project_id}`}>{s.project_name}</Link> : <span className="faint">—</span>}</td>
        <td className="mono">{s.current_version}</td>
        <td>
          <StatusBadge status={s.status} />
        </td>
        <td>
          {attention > 0 ? (
            <span className="badge open" title={`${s.open_feedback_count} open feedback · ${s.pending_review_count} pending review`}>
              {s.pending_review_count > 0 && `${s.pending_review_count} review`}
              {s.pending_review_count > 0 && s.open_feedback_count > 0 && " · "}
              {s.open_feedback_count > 0 && `${s.open_feedback_count} open`}
            </span>
          ) : (
            <span className="faint">—</span>
          )}
        </td>
        <td className="dim">{s.updated_by}</td>
        <td className="faint">{timeAgo(s.updated_at)}</td>
      </tr>
    );
  }

  function scopeTable(rows: SpecSummary[]) {
    return (
      <table className="grid">
        <thead>
          <tr>
            <th>File</th>
            <th>Scope</th>
            <th>Project</th>
            <th>Version</th>
            <th>Status</th>
            <th>Alerts</th>
            <th>Updated by</th>
            <th>Updated</th>
          </tr>
        </thead>
        <tbody>{rows.map(specRow)}</tbody>
      </table>
    );
  }

  return (
    <>
      <div className="page-head">
        {embedded ? <span className="sub">Governed specs organized by scope: global, project types, and projects</span> : <h1>Specifications</h1>}
        <button className="primary" onClick={() => setCreating((v) => !v)}>
          {creating ? "Cancel" : "New spec"}
        </button>
      </div>
      {error && <div className="error-banner">{error}</div>}

      {creating && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="form-row">
            <select value={newTypeId} onChange={(e) => setNewTypeId(e.target.value)}>
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.scope === "global" ? `${t.name} (global)` : t.name}
                </option>
              ))}
            </select>
            <select
              value={newProjectId}
              onChange={(e) => {
                const next = e.target.value;
                setNewProjectId(next);
                const project = projects.find((item) => item.id === next);
                if (project) setNewTypeId(project.project_type_id);
              }}
            >
              <option value="">Baseline scope</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.repo}
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder="FILENAME.md"
              value={newFilename}
              onChange={(e) => {
                setNewFilename(e.target.value);
                setAssistContent("");
                setAssistModel("");
                setAssistProvider("");
              }}
              onKeyDown={(e) => e.key === "Enter" && createSpec()}
            />
            <button className="primary" onClick={createSpec}>
              Create draft
            </button>
          </div>
          <div className="form-row" style={{ alignItems: "flex-start" }}>
            <textarea
              className="audit-guidance-input"
              style={{ minHeight: 76, flex: 1, minWidth: 320 }}
              placeholder="Guidance for an LLM-generated starter spec"
              value={assistGuidance}
              onChange={(e) => setAssistGuidance(e.target.value)}
              disabled={assisting}
            />
            <button
              className="primary"
              onClick={generateAssistedDraft}
              disabled={assisting || !newFilename.trim() || !assistGuidance.trim()}
            >
              {assisting ? "Generating..." : assistContent ? "Regenerate" : "Generate draft"}
            </button>
          </div>
          {assistContent && (
            <>
              <div className="toolbar" style={{ marginTop: 12 }}>
                <span className="faint">
                  {assistProvider}/{assistModel}
                </span>
              </div>
              <div className="split" style={{ marginTop: 12 }}>
                <textarea
                  className="editor"
                  style={{ minHeight: 360 }}
                  value={assistContent}
                  onChange={(e) => setAssistContent(e.target.value)}
                  spellCheck={false}
                />
                <Markdown content={assistContent} />
              </div>
            </>
          )}
          <span className="faint">
            New specs start as 0.1.0 drafts. Baseline specs apply to every project of that type; project specs apply only to the selected project.
          </span>
        </div>
      )}

      {/* Faceted filter bar (Option B) over scope-first grouping (Option A). */}
      <div className="filter-panel spec-filter-bar">
        <div className="spec-filter-row">
          <div className="spec-scope-chips" role="group" aria-label="Filter by scope">
            {(["all", ...SCOPE_ORDER] as Array<Scope | "all">).map((sc) => {
              const label = sc === "all" ? "All scopes" : SCOPE_META[sc].label;
              const count = sc === "all" ? specs.length : specs.filter((s) => s.effective_scope === sc).length;
              return (
                <button
                  key={sc}
                  className={`chip${scopeFilter === sc ? " active" : ""}`}
                  onClick={() => setScopeFilter(sc)}
                  aria-pressed={scopeFilter === sc}
                >
                  {label}
                  <span className="chip-count">{count}</span>
                </button>
              );
            })}
          </div>
          <div className="right">
            <span className="faint">
              {totalShown} spec{totalShown === 1 ? "" : "s"}
              {activeFilters && ` of ${specs.length}`}
            </span>
            {activeFilters && (
              <button style={{ fontSize: 12 }} onClick={clearFilters}>
                Clear filters
              </button>
            )}
          </div>
        </div>
        <div className="spec-filter-row">
          <input
            type="text"
            placeholder="Filter by file, type, or project…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ minWidth: 240 }}
          />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            disabled={scopeFilter === "global" || scopeFilter === "project" || typeOptions.length === 0}
            title={scopeFilter === "global" || scopeFilter === "project" ? "Project type applies to the Project types scope" : undefined}
          >
            <option value="all">All project types</option>
            {typeOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            disabled={scopeFilter === "global" || scopeFilter === "project_type" || projectOptions.length === 0}
            title={scopeFilter === "global" || scopeFilter === "project_type" ? "Project applies to the Projects scope" : undefined}
          >
            <option value="all">All projects</option>
            {projectOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}>
            <option value="all">All statuses</option>
            <option value="draft">Draft</option>
            <option value="pending_review">Pending review</option>
            <option value="published">Published</option>
          </select>
          <label className="inline-check">
            <input type="checkbox" checked={attentionOnly} onChange={(e) => setAttentionOnly(e.target.checked)} />
            Needs attention only
          </label>
        </div>
      </div>

      {byScope.map(({ scope, total, attention, subgroups }) => {
        if (total === 0) return null;
        const meta = SCOPE_META[scope];
        const isCollapsed = collapsed[scope];
        return (
          <div className="section spec-scope" key={scope}>
            <button
              className="spec-scope-head"
              onClick={() => setCollapsed((c) => ({ ...c, [scope]: !c[scope] }))}
              title={meta.hint}
            >
              <span className="spec-scope-caret">{isCollapsed ? "▸" : "▾"}</span>
              <span className={`badge ${meta.badge}`}>{meta.label}</span>
              <span className="faint">{total}</span>
              {attention > 0 && <span className="badge open">{attention} need attention</span>}
              <span className="spec-scope-hint faint">{meta.hint}</span>
            </button>
            {!isCollapsed &&
              subgroups.map((sg) => (
                <div key={`${scope}:${sg.name}`} className="spec-subgroup">
                  {sg.name && <h3 className="spec-subgroup-head">{sg.name}</h3>}
                  {scopeTable(sg.rows)}
                </div>
              ))}
          </div>
        );
      })}

      {totalShown === 0 && (
        <p className="dim" style={{ marginTop: 8 }}>
          {activeFilters ? "No specs match the current filters." : "No specs yet."}
        </p>
      )}

      <div className="section" style={{ marginTop: 24 }}>
        <button
          style={{ fontSize: 13, opacity: 0.7 }}
          onClick={() => {
            const next = !showDeleted;
            setShowDeleted(next);
            if (next) loadDeleted();
          }}
        >
          {showDeleted ? "▾ Hide deleted specs" : "▸ Show deleted specs"}
        </button>
        {showDeleted && (
          <>
            {deletedSpecs.length === 0 ? (
              <p className="dim" style={{ marginTop: 8 }}>No deleted specs.</p>
            ) : (
              <table className="grid" style={{ marginTop: 8 }}>
                <thead>
                  <tr>
                    <th>File</th>
                    <th>Project type</th>
                    <th>Version</th>
                    <th>Deleted</th>
                    <th>Purge in</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {deletedSpecs.map((ds) => {
                    const deletedDate = new Date(ds.deleted_at);
                    const purgeDate = new Date(deletedDate.getTime() + 14 * 24 * 60 * 60 * 1000);
                    const daysLeft = Math.max(0, Math.ceil((purgeDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
                    return (
                      <tr key={ds.id} style={{ opacity: 0.7 }}>
                        <td className="mono">{ds.filename}</td>
                        <td>{ds.project_type_name}</td>
                        <td className="mono">{ds.current_version}</td>
                        <td className="faint">{timeAgo(ds.deleted_at)}</td>
                        <td className="faint">{daysLeft}d</td>
                        <td>
                          <button
                            className="success"
                            style={{ fontSize: 12 }}
                            disabled={restoring === ds.id}
                            onClick={async () => {
                              setRestoring(ds.id);
                              try {
                                await api.restoreSpec(ds.id);
                                reload();
                                loadDeleted();
                              } catch (e) {
                                setError((e as Error).message);
                              } finally {
                                setRestoring(null);
                              }
                            }}
                          >
                            {restoring === ds.id ? "Restoring..." : "Restore"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>
    </>
  );
}
