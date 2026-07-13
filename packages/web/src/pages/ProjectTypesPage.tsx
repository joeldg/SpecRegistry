import { useCallback, useEffect, useState } from "react";
import { api, type ProjectTypeWithCount } from "../api";
import { timeAgo } from "../components";

export default function ProjectTypesPage() {
  const [types, setTypes] = useState<ProjectTypeWithCount[]>([]);
  const [error, setError] = useState<string>();
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [description, setDescription] = useState("");

  const reload = useCallback(() => {
    api
      .projectTypes()
      .then(setTypes)
      .catch((e) => setError(e.message));
  }, []);

  useEffect(reload, [reload]);

  async function create() {
    if (!name.trim()) return;
    try {
      await api.createProjectType({
        name: name.trim(),
        industry: industry.trim() || undefined,
        description: description.trim() || undefined,
      });
      setName("");
      setIndustry("");
      setDescription("");
      reload();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <>
      <div className="page-head">
        <h1>Baselines</h1>
        <span className="sub">Reusable project-type guidance inherited by concrete projects</span>
      </div>
      {error && <div className="error-banner">{error}</div>}

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="form-row">
          <input type="text" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <input
            type="text"
            placeholder="Industry"
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
          />
          <input
            type="text"
            placeholder="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{ flex: 1, minWidth: 240 }}
          />
          <button className="primary" onClick={create}>
            Add baseline
          </button>
        </div>
      </div>

      <table className="grid">
        <thead>
          <tr>
            <th>Name</th>
            <th>Scope</th>
            <th>Industry</th>
            <th>Description</th>
            <th>Baseline specs</th>
            <th>Projects</th>
            <th>Project specs</th>
            <th>Required reviewers</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          {types.map((t) => (
            <tr key={t.id}>
              <td>{t.name}</td>
              <td>{t.scope === "global" ? <span className="badge global">global</span> : "baseline"}</td>
              <td className="dim">{t.industry ?? "—"}</td>
              <td className="dim">
                {t.description ?? "—"}
                {t.project_type_smell ? (
                  <div className="badge pending" style={{ marginTop: 4 }}>looks project-specific</div>
                ) : null}
              </td>
              <td className="mono">{t.spec_count}</td>
              <td className="mono">{t.project_count ?? 0}</td>
              <td className="mono">{t.project_spec_count ?? 0}</td>
              <td>
                <ReviewerEditor type={t} onSaved={reload} onError={setError} />
              </td>
              <td className="faint">{timeAgo(t.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function ReviewerEditor({
  type,
  onSaved,
  onError,
}: {
  type: ProjectTypeWithCount & { required_reviewers?: string };
  onSaved: () => void;
  onError: (msg: string) => void;
}) {
  const initial = (() => {
    try {
      return (JSON.parse(type.required_reviewers ?? "[]") as string[]).join(", ");
    } catch {
      return "";
    }
  })();
  const [value, setValue] = useState(initial);

  async function save() {
    try {
      await api.updateProjectType(type.id, {
        required_reviewers: value.split(",").map((s) => s.trim()).filter(Boolean),
      });
      onSaved();
    } catch (e) {
      onError((e as Error).message);
    }
  }

  return (
    <input
      type="text"
      placeholder="anyone"
      title="Comma-separated reviewer usernames; approvals are restricted to these (admins bypass)"
      value={value}
      style={{ width: 160 }}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => value !== initial && save()}
      onKeyDown={(e) => e.key === "Enter" && save()}
    />
  );
}
