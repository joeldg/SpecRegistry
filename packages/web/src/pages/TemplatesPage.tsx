import { useCallback, useEffect, useState } from "react";
import type { SpecTemplate } from "@specregistry/shared";
import { api } from "../api";

const SAMPLE_TEMPLATE = `# [Specification Title]

<!-- INSTRUCTIONS: Describe the high-level objective, purpose, and scope of this specification. -->

## System Architecture
<!-- INSTRUCTIONS: Map out the high-level system components, data flows, and design patterns. -->

## Entry Points
<!-- INSTRUCTIONS: Detail the entry points, configuration files, and critical paths in the repository. -->

## Observability
<!-- INSTRUCTIONS: Describe how to monitor this system, key metrics, and logging guidelines. -->

## Failure Modes
<!-- INSTRUCTIONS: Document error handling, graceful degradation, and recovery/rollback actions. -->
`;

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<SpecTemplate[]>([]);
  const [error, setError] = useState<string>();
  const [filename, setFilename] = useState("");
  const [sections, setSections] = useState("");
  const [body, setBody] = useState(SAMPLE_TEMPLATE);
  const [description, setDescription] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const reload = useCallback(() => {
    api.templates().then(setTemplates).catch((e) => setError(e.message));
  }, []);

  useEffect(reload, [reload]);

  async function create() {
    if (!filename.trim()) return;
    try {
      await api.createTemplate({
        filename: filename.trim(),
        required_sections: sections.split(",").map((s) => s.trim()).filter(Boolean),
        content_template: body,
        description: description.trim() || undefined,
      });
      setFilename("");
      setSections("");
      setBody(SAMPLE_TEMPLATE);
      setDescription("");
      reload();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function update() {
    if (!editingId) return;
    try {
      await api.updateTemplate(editingId, {
        required_sections: sections.split(",").map((s) => s.trim()).filter(Boolean),
        content_template: body,
        description: description.trim() || "",
      });
      cancelEdit();
      reload();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function startEdit(t: SpecTemplate) {
    setEditingId(t.id);
    setFilename(t.filename);
    let parsed: string[] = [];
    try { parsed = JSON.parse(t.required_sections); } catch {}
    setSections(parsed.join(", "));
    setBody(t.content_template);
    setDescription(t.description ?? "");
  }

  function cancelEdit() {
    setEditingId(null);
    setFilename("");
    setSections("");
    setBody(SAMPLE_TEMPLATE);
    setDescription("");
  }

  async function remove(id: string) {
    if (editingId === id) {
      cancelEdit();
    }
    try {
      await api.deleteTemplate(id);
      reload();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <>
      <div className="page-head">
        <h1>Spec Templates</h1>
        <span className="sub">Required sections are linted on every change request; the body seeds new drafts</span>
      </div>
      {error && <div className="error-banner">{error}</div>}

      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ marginBottom: 12, fontWeight: 600, fontSize: "14px" }}>
          {editingId ? `Editing Template: ${filename}` : "Create New Spec Template"}
        </div>
        <div className="form-row" style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "12px" }}>
          <input
            type="text"
            placeholder="FILENAME.md"
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
            disabled={!!editingId}
            style={{ width: "200px" }}
          />
          <input
            type="text"
            placeholder="Required sections (comma-separated)"
            value={sections}
            style={{ flex: 1, minWidth: 280 }}
            onChange={(e) => setSections(e.target.value)}
          />
          <input
            type="text"
            placeholder="Description (optional)"
            value={description}
            style={{ width: "240px" }}
            onChange={(e) => setDescription(e.target.value)}
          />
          {editingId ? (
            <>
              <button className="primary" onClick={update}>
                Save Changes
              </button>
              <button onClick={cancelEdit}>
                Cancel
              </button>
            </>
          ) : (
            <button className="primary" onClick={create}>
              Add Template
            </button>
          )}
        </div>
        <textarea
          className="editor"
          style={{ minHeight: 200, width: "100%", fontFamily: "var(--mono)", background: "#0e0f12", color: "#e6e9ef", border: "1px solid var(--border)", borderRadius: "4px", padding: "10px" }}
          placeholder="Markdown skeleton used when creating a new spec with this filename…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          spellCheck={false}
        />
      </div>

      {templates.length === 0 ? (
        <div className="empty">No templates yet.</div>
      ) : (
        <table className="grid">
          <thead>
            <tr>
              <th>Filename</th>
              <th>Required sections</th>
              <th>Description</th>
              <th style={{ width: "160px" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {templates.map((t) => (
              <tr key={t.id}>
                <td className="mono">{t.filename}</td>
                <td>
                  {(JSON.parse(t.required_sections) as string[]).map((s) => (
                    <span key={s} className="badge" style={{ marginRight: 6 }}>
                      {s}
                    </span>
                  ))}
                </td>
                <td className="dim">{t.description ?? "—"}</td>
                <td>
                  <button style={{ marginRight: 8 }} onClick={() => startEdit(t)}>
                    Edit
                  </button>
                  <button className="danger" onClick={() => remove(t.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

