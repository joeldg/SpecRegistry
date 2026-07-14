import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type ProjectRow, type ProjectTypeWithCount } from "../api";
import { StatusBadge, timeAgo } from "../components";

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [types, setTypes] = useState<ProjectTypeWithCount[]>([]);
  const [error, setError] = useState<string>();
  const [repo, setRepo] = useState("");
  const [projectTypeId, setProjectTypeId] = useState("");
  const [branch, setBranch] = useState("");
  const navigate = useNavigate();

  const reload = useCallback(() => {
    Promise.all([api.projects(), api.projectTypes()])
      .then(([p, t]) => {
        setProjects(p);
        setTypes(t.filter((item) => item.scope === "project_type"));
        if (!projectTypeId) {
          const first = t.find((item) => item.scope === "project_type");
          if (first) setProjectTypeId(first.id);
        }
      })
      .catch((e) => setError(e.message));
  }, [projectTypeId]);

  useEffect(reload, [reload]);

  async function create() {
    if (!repo.trim() || !projectTypeId) return;
    setError(undefined);
    try {
      const project = await api.createProject({
        repo: repo.trim(),
        project_type_id: projectTypeId,
        branch: branch.trim() || undefined,
      });
      setRepo("");
      setBranch("");
      navigate(`/projects/${project.id}`);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <>
      <div className="page-head">
        <h1>Projects</h1>
        <span className="sub">Concrete repositories attached to reusable baselines</span>
      </div>
      {error && <div className="error-banner">{error}</div>}

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="form-row">
          <input type="text" placeholder="owner/repo or project name" value={repo} onChange={(e) => setRepo(e.target.value)} />
          <select value={projectTypeId} onChange={(e) => setProjectTypeId(e.target.value)}>
            {types.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </select>
          <input type="text" placeholder="Branch" value={branch} onChange={(e) => setBranch(e.target.value)} />
          <button className="primary" onClick={create} disabled={!repo.trim() || !projectTypeId}>
            Add project
          </button>
        </div>
      </div>

      <table className="grid">
        <thead>
          <tr>
            <th>Project</th>
            <th>Baseline</th>
            <th>Reported</th>
            <th>Project specs</th>
            <th>Spec currency</th>
            <th>Branch</th>
            <th>Last seen</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((project) => (
            <tr key={project.id} className="click" onClick={() => navigate(`/projects/${project.id}`)}>
              <td className="mono">{project.repo}</td>
              <td>{project.project_type_name}</td>
              <td className="mono">{project.spec_count}</td>
              <td className="mono">{project.project_spec_count}</td>
              <td>
                {project.outdated_count > 0 ? (
                  <span className="badge pending">{project.outdated_count} outdated</span>
                ) : (
                  <span className="badge approved">current</span>
                )}
              </td>
              <td className="mono">{project.branch ?? "—"}</td>
              <td className="faint">{timeAgo(project.last_seen_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
