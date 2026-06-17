import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  api,
  getAuthor,
  type GenerationPreview,
  type ProjectTypeWithCount,
  type SpecGap,
  type SpecPurposeTemplate,
} from "../api";

const SAMPLE_TREE = `src/
src/routes/
src/routes/api.ts
src/db/schema.sql
src/auth/session.ts
tests/api.test.ts
docker-compose.yml`;

function detectedLanguages(tree: string): string[] {
  const languages = new Set<string>();
  if (/\.(ts|tsx)\b/.test(tree)) languages.add("TypeScript");
  if (/\.py\b/.test(tree)) languages.add("Python");
  if (/\.go\b/.test(tree)) languages.add("Go");
  if (/\.rs\b/.test(tree)) languages.add("Rust");
  if (/\.sql\b/.test(tree)) languages.add("SQL");
  if (/docker|compose|kubernetes|helm/i.test(tree)) languages.add("Deployment");
  return [...languages];
}

export default function GenerationWorkbenchPage() {
  const [projectTypes, setProjectTypes] = useState<ProjectTypeWithCount[]>([]);
  const [purposes, setPurposes] = useState<SpecPurposeTemplate[]>([]);
  const [projectType, setProjectType] = useState("");
  const [purposeId, setPurposeId] = useState("");
  const [tree, setTree] = useState(SAMPLE_TREE);
  const [extraContext, setExtraContext] = useState("");
  const [useLlm, setUseLlm] = useState(false);
  const [gaps, setGaps] = useState<SpecGap[]>([]);
  const [preview, setPreview] = useState<GenerationPreview>();
  const [content, setContent] = useState("");
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [busy, setBusy] = useState<string>();
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([api.projectTypes(), api.specPurposes()])
      .then(([types, nextPurposes]) => {
        const selectable = types.filter((type) => type.scope === "project_type");
        setProjectTypes(selectable);
        setPurposes(nextPurposes);
        setProjectType(selectable[0]?.name ?? "");
        setPurposeId(nextPurposes[0]?.id ?? "");
      })
      .catch((e) => setError(e.message));
  }, []);

  const languages = useMemo(() => detectedLanguages(tree), [tree]);
  const selectedPurpose = purposes.find((purpose) => purpose.id === purposeId);

  async function detectGaps() {
    if (!projectType) return;
    setBusy("gaps");
    setError(undefined);
    setNotice(undefined);
    try {
      const result = await api.specGaps({ project_type: projectType, tree, detected_languages: languages });
      setGaps(result.gaps);
      if (result.gaps[0]) setPurposeId(result.gaps[0].purpose_id);
      setNotice(`Detected ${result.gaps.length} candidate spec gap(s).`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(undefined);
    }
  }

  async function generate() {
    if (!projectType || !purposeId) return;
    setBusy("generate");
    setError(undefined);
    setNotice(undefined);
    try {
      const result = await api.generationPreview({
        project_type: projectType,
        purpose: purposeId,
        tree,
        detected_languages: languages,
        extra_context: extraContext,
        use_llm: useLlm,
      });
      setPreview(result);
      setContent(result.content);
      setNotice(useLlm ? `Generated with ${result.provider}/${result.model}.` : "Generated deterministic draft from the purpose template.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(undefined);
    }
  }

  async function createDraft() {
    if (!preview || !content.trim()) return;
    setBusy("draft");
    setError(undefined);
    try {
      const draft = await api.createGeneratedDraft({
        project_type: projectType,
        purpose: preview.purpose.id,
        filename: preview.filename,
        content,
        updated_by: getAuthor(),
      });
      navigate(`/specs/${draft.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(undefined);
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Generate Specs</h1>
          <span className="sub">Detect missing spec coverage and generate reviewed drafts from purpose templates</span>
        </div>
      </div>
      {error && <div className="error-banner">{error}</div>}
      {notice && <div className="notice-banner">{notice}</div>}

      <div className="split">
        <div className="section">
          <h2>Repo Evidence</h2>
          <div className="card">
            <div className="form-row">
              <select value={projectType} onChange={(e) => setProjectType(e.target.value)}>
                {projectTypes.map((type) => (
                  <option key={type.id} value={type.name}>{type.name}</option>
                ))}
              </select>
              <button onClick={detectGaps} disabled={!projectType || busy === "gaps"}>
                {busy === "gaps" ? "Detecting..." : "Detect gaps"}
              </button>
            </div>
            <textarea className="editor" style={{ minHeight: 260 }} value={tree} onChange={(e) => setTree(e.target.value)} />
            <div className="faint">Detected: {languages.join(", ") || "unknown"}</div>
          </div>

          <div className="section" style={{ marginTop: 18 }}>
            <h2>Detected Gaps</h2>
            {gaps.length === 0 ? (
              <div className="empty">Run gap detection to find missing spec purposes.</div>
            ) : (
              <table className="grid">
                <thead>
                  <tr>
                    <th>Spec</th>
                    <th>Confidence</th>
                    <th>Evidence</th>
                  </tr>
                </thead>
                <tbody>
                  {gaps.map((gap) => (
                    <tr key={gap.purpose_id} className="click" onClick={() => setPurposeId(gap.purpose_id)}>
                      <td>
                        <div className="mono">{gap.filename}</div>
                        <div className="dim">{gap.reason}</div>
                      </td>
                      <td className="mono">{Math.round(gap.confidence * 100)}%</td>
                      <td className="dim">{gap.evidence.join(", ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="section">
          <h2>Generation</h2>
          <div className="card">
            <div className="form-row">
              <select value={purposeId} onChange={(e) => setPurposeId(e.target.value)}>
                {purposes.map((purpose) => (
                  <option key={purpose.id} value={purpose.id}>{purpose.title} · {purpose.filename}</option>
                ))}
              </select>
              <label className="faint">
                <input type="checkbox" checked={useLlm} onChange={(e) => setUseLlm(e.target.checked)} /> Use server LLM
              </label>
              <button className="primary" onClick={generate} disabled={!purposeId || busy === "generate"}>
                {busy === "generate" ? "Generating..." : "Generate"}
              </button>
            </div>
            {selectedPurpose && (
              <div className="dim" style={{ marginBottom: 10 }}>
                {selectedPurpose.description} Required sections: {selectedPurpose.required_sections.join(", ")}.
              </div>
            )}
            <textarea
              rows={4}
              value={extraContext}
              onChange={(e) => setExtraContext(e.target.value)}
              placeholder="Additional intent, constraints, or source evidence..."
            />
          </div>

          {preview && (
            <div className="section" style={{ marginTop: 18 }}>
              <h2>Draft Preview</h2>
              <div className="toolbar">
                <span className="mono">{preview.filename}</span>
                <button className="success" onClick={createDraft} disabled={busy === "draft"}>
                  {busy === "draft" ? "Creating..." : "Create registry draft"}
                </button>
              </div>
              <textarea className="editor" value={content} onChange={(e) => setContent(e.target.value)} spellCheck={false} />
              <details>
                <summary className="faint">Generation prompt</summary>
                <pre className="diff" style={{ padding: 12 }}>{preview.prompt}</pre>
              </details>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
