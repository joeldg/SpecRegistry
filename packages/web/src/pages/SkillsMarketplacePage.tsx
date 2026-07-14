import { useCallback, useEffect, useMemo, useState } from "react";
import { api, getAuthor, type AgentSkillRow, type SkillCandidateRow, type SkillReviewRow, type SkillSourceRow } from "../api";
import { StatusBadge, timeAgo } from "../components";

type SkillTab = "installed" | "sources" | "candidates" | "reviews";

function parseList(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export default function SkillsMarketplacePage() {
  const [tab, setTab] = useState<SkillTab>("installed");
  const [skills, setSkills] = useState<AgentSkillRow[]>([]);
  const [sources, setSources] = useState<SkillSourceRow[]>([]);
  const [candidates, setCandidates] = useState<SkillCandidateRow[]>([]);
  const [reviews, setReviews] = useState<SkillReviewRow[]>([]);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceType, setSourceType] = useState<SkillSourceRow["source_type"]>("github_repo");
  const [sourceLicense, setSourceLicense] = useState("");
  const [sourceNotes, setSourceNotes] = useState("");
  const [candidateSourceId, setCandidateSourceId] = useState("");
  const [candidateName, setCandidateName] = useState("");
  const [candidatePath, setCandidatePath] = useState("");
  const [candidateType, setCandidateType] = useState<SkillCandidateRow["candidate_type"] | "">("");
  const [candidateContent, setCandidateContent] = useState("");

  const reload = useCallback(() => {
    setError(undefined);
    Promise.all([api.agentSkills(true), api.skillSources(), api.skillCandidates(), api.skillReviews()])
      .then(([nextSkills, nextSources, nextCandidates, nextReviews]) => {
        setSkills(nextSkills);
        setSources(nextSources);
        setCandidates(nextCandidates);
        setReviews(nextReviews);
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(reload, [reload]);

  const summary = useMemo(() => {
    const activeSkills = skills.filter((skill) => skill.status === "active").length;
    const openCandidates = candidates.filter((candidate) => candidate.status === "candidate").length;
    const restrictedCandidates = candidates.filter((candidate) => candidate.risk_level === "restricted").length;
    const pendingReviews = reviews.filter((review) => review.status === "pending").length;
    return { activeSkills, openCandidates, restrictedCandidates, pendingReviews };
  }, [skills, candidates, reviews]);

  async function createSource() {
    if (!sourceUrl.trim()) return;
    setError(undefined);
    setNotice(undefined);
    try {
      await api.createSkillSource({
        url: sourceUrl.trim(),
        source_type: sourceType,
        license: sourceLicense.trim() || undefined,
        notes: sourceNotes.trim() || undefined,
      });
      setSourceUrl("");
      setSourceLicense("");
      setSourceNotes("");
      setNotice("Skill source registered.");
      reload();
      setTab("sources");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function createCandidate() {
    if (!candidateName.trim() || !candidateContent.trim()) return;
    setError(undefined);
    setNotice(undefined);
    try {
      await api.createSkillCandidate({
        source_id: candidateSourceId || undefined,
        source_path: candidatePath.trim() || undefined,
        detected_format: candidatePath.endsWith("SKILL.md") ? "skill_markdown" : "manual_markdown",
        raw_content: candidateContent,
        proposed_name: candidateName.trim(),
        candidate_type: candidateType || undefined,
      });
      setCandidateName("");
      setCandidatePath("");
      setCandidateContent("");
      setNotice("Candidate captured for review.");
      reload();
      setTab("candidates");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function classifyCandidate(id: string) {
    setError(undefined);
    setNotice(undefined);
    try {
      await api.classifySkillCandidate(id);
      setNotice("Candidate reclassified.");
      reload();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function runCandidateGates(id: string) {
    setError(undefined);
    setNotice(undefined);
    try {
      await api.runSkillCandidateGates(id);
      setNotice("Candidate gates evaluated.");
      reload();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function convertCandidate(id: string) {
    setError(undefined);
    setNotice(undefined);
    try {
      await api.convertSkillCandidate(id);
      setNotice("Candidate converted to a disabled skill draft.");
      reload();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function submitSkillReview(skill: AgentSkillRow, action: SkillReviewRow["action"]) {
    setError(undefined);
    setNotice(undefined);
    try {
      await api.createSkillReview(skill.id, {
        action,
        status: action === "enable" ? "active" : action === "disable" || action === "delete" ? "disabled" : skill.status,
        summary: `Review ${action} for ${skill.slug}.`,
      });
      setNotice("Skill review submitted.");
      reload();
      setTab("reviews");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function closeSkillReview(id: string, action: "approve" | "reject") {
    setError(undefined);
    setNotice(undefined);
    try {
      if (action === "approve") await api.approveSkillReview(id, getAuthor());
      else await api.rejectSkillReview(id, getAuthor());
      setNotice(action === "approve" ? "Skill review approved." : "Skill review rejected.");
      reload();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <>
      <div className="page-head">
        <h1>Skills Marketplace</h1>
        <span className="sub">Governed procedures, external sources, and untrusted candidates for review</span>
      </div>
      {error && <div className="error-banner">{error}</div>}
      {notice && <div className="notice-banner">{notice}</div>}

      <div className="cards" style={{ marginBottom: 16 }}>
        <div className="card">
          <div className="metric">{summary.activeSkills}</div>
          <div className="label">Active skills</div>
        </div>
        <div className="card">
          <div className="metric">{sources.length}</div>
          <div className="label">Sources</div>
        </div>
        <div className="card">
          <div className="metric">{summary.openCandidates}</div>
          <div className="label">Candidates</div>
        </div>
        <div className={`card${summary.restrictedCandidates ? " alert" : ""}`}>
          <div className="metric">{summary.restrictedCandidates}</div>
          <div className="label">Restricted candidates</div>
        </div>
        <div className={`card${summary.pendingReviews ? " alert" : ""}`}>
          <div className="metric">{summary.pendingReviews}</div>
          <div className="label">Pending reviews</div>
        </div>
      </div>

      <div className="settings-tabs" style={{ marginBottom: 16 }}>
        <button className={tab === "installed" ? "active" : ""} onClick={() => setTab("installed")}>Installed</button>
        <button className={tab === "sources" ? "active" : ""} onClick={() => setTab("sources")}>Sources</button>
        <button className={tab === "candidates" ? "active" : ""} onClick={() => setTab("candidates")}>Candidates</button>
        <button className={tab === "reviews" ? "active" : ""} onClick={() => setTab("reviews")}>Reviews</button>
      </div>

      {tab === "installed" && (
        <div className="section">
          <h2>Installed Skills</h2>
          <table className="grid">
            <thead>
              <tr>
                <th>Skill</th>
                <th>Risk</th>
                <th>Status</th>
                <th>Description</th>
                <th>Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {skills.map((skill) => (
                <tr key={skill.id}>
                  <td><strong>{skill.name}</strong><div className="mono faint">{skill.slug}{skill.built_in ? " · built in" : ""}</div></td>
                  <td><StatusBadge status={skill.risk_level} /></td>
                  <td><StatusBadge status={skill.status} /></td>
                  <td>{skill.description}</td>
                  <td className="faint">{timeAgo(skill.updated_at)}</td>
                  <td>
                    {skill.status === "disabled" ? (
                      <button onClick={() => submitSkillReview(skill, "enable")}>Review enable</button>
                    ) : (
                      <button onClick={() => submitSkillReview(skill, "disable")}>Review disable</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "sources" && (
        <>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="form-row" style={{ marginBottom: 10 }}>
              <input type="text" placeholder="https://github.com/org/repo" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} style={{ flex: 1, minWidth: 280 }} />
              <select value={sourceType} onChange={(e) => setSourceType(e.target.value as SkillSourceRow["source_type"])}>
                <option value="github_repo">GitHub repo</option>
                <option value="github_search">GitHub search</option>
                <option value="local_upload">Local upload</option>
                <option value="builtin_pack">Built-in pack</option>
                <option value="manual">Manual</option>
              </select>
              <input type="text" placeholder="License" value={sourceLicense} onChange={(e) => setSourceLicense(e.target.value)} />
              <button className="primary" onClick={createSource} disabled={!sourceUrl.trim()}>Add source</button>
            </div>
            <textarea placeholder="Source notes" value={sourceNotes} onChange={(e) => setSourceNotes(e.target.value)} style={{ width: "100%", minHeight: 70 }} />
          </div>
          <table className="grid">
            <thead>
              <tr>
                <th>Source</th>
                <th>Type</th>
                <th>Trust</th>
                <th>Status</th>
                <th>License</th>
                <th>Last scan</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((source) => (
                <tr key={source.id}>
                  <td className="mono">{source.url}<div className="faint">{source.notes}</div></td>
                  <td>{source.source_type}</td>
                  <td><StatusBadge status={source.trust_decision} /></td>
                  <td><StatusBadge status={source.status} /></td>
                  <td>{source.license ?? "unknown"}</td>
                  <td className="faint">{source.last_scan_at ? timeAgo(source.last_scan_at) : "never"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {tab === "candidates" && (
        <>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="form-row" style={{ marginBottom: 10 }}>
              <select value={candidateSourceId} onChange={(e) => setCandidateSourceId(e.target.value)}>
                <option value="">No source</option>
                {sources.map((source) => (
                  <option key={source.id} value={source.id}>{source.url}</option>
                ))}
              </select>
              <input type="text" placeholder="Candidate name" value={candidateName} onChange={(e) => setCandidateName(e.target.value)} />
              <input type="text" placeholder="Source path" value={candidatePath} onChange={(e) => setCandidatePath(e.target.value)} />
              <select value={candidateType} onChange={(e) => setCandidateType(e.target.value as SkillCandidateRow["candidate_type"] | "")}>
                <option value="">Auto classify</option>
                <option value="unknown">Unknown</option>
                <option value="agent_skill">Agent skill</option>
                <option value="spec_seed">Spec seed</option>
                <option value="project_type_template">Project type template</option>
                <option value="reference_only">Reference only</option>
                <option value="unsafe">Unsafe</option>
              </select>
              <button className="primary" onClick={createCandidate} disabled={!candidateName.trim() || !candidateContent.trim()}>Capture candidate</button>
            </div>
            <textarea placeholder="Paste untrusted source material here. It will not be included in agent packs until reviewed and converted." value={candidateContent} onChange={(e) => setCandidateContent(e.target.value)} style={{ width: "100%", minHeight: 120 }} />
          </div>
          <table className="grid">
            <thead>
              <tr>
                <th>Candidate</th>
                <th>Type</th>
                <th>Risk</th>
                <th>Gates</th>
                <th>Signals</th>
                <th>Status</th>
                <th>Source</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((candidate) => {
                const signalCount = parseList(candidate.detected_commands).length + parseList(candidate.detected_network).length + parseList(candidate.detected_secrets).length;
                return (
                  <tr key={candidate.id}>
                    <td><strong>{candidate.proposed_name}</strong><div className="mono faint">{candidate.proposed_slug}</div></td>
                    <td>{candidate.candidate_type}<div className="faint">{candidate.category ?? "uncategorized"}</div></td>
                    <td><StatusBadge status={candidate.risk_level} /></td>
                    <td><StatusBadge status={candidate.gate_status} /><div className="faint">{parseList(candidate.gate_results).length} checks</div></td>
                    <td>{signalCount ? <span className="badge pending">{signalCount} signals</span> : <span className="badge approved">clear</span>}<div className="faint">{candidate.risk_summary}</div><div className="faint">{candidate.classifier_notes}</div></td>
                    <td><StatusBadge status={candidate.status} /></td>
                    <td className="mono">{candidate.source_path ?? candidate.source_url ?? "manual"}<div className="faint">{candidate.raw_content_hash.slice(0, 12)}</div></td>
                    <td>
                      <button onClick={() => classifyCandidate(candidate.id)}>Reclassify</button>{" "}
                      <button onClick={() => runCandidateGates(candidate.id)}>Run gates</button>
                      {candidate.candidate_type === "agent_skill" && candidate.gate_status !== "block" && candidate.status !== "converted" && (
                        <>
                          {" "}
                          <button onClick={() => convertCandidate(candidate.id)}>Convert draft</button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}

      {tab === "reviews" && (
        <div className="section">
          <h2>Skill Reviews</h2>
          <table className="grid">
            <thead>
              <tr>
                <th>Skill</th>
                <th>Action</th>
                <th>Proposed</th>
                <th>Status</th>
                <th>Submitted</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {reviews.map((review) => (
                <tr key={review.id}>
                  <td><strong>{review.proposed_name}</strong><div className="mono faint">{review.skill_slug}</div></td>
                  <td>{review.action}</td>
                  <td><StatusBadge status={review.proposed_status} /> <StatusBadge status={review.proposed_risk_level} /><div className="faint">{review.summary}</div></td>
                  <td><StatusBadge status={review.status} /></td>
                  <td>{review.proposed_by}<div className="faint">{timeAgo(review.created_at)}</div></td>
                  <td>
                    {review.status === "pending" ? (
                      <>
                        <button onClick={() => closeSkillReview(review.id, "approve")}>Approve</button>{" "}
                        <button onClick={() => closeSkillReview(review.id, "reject")}>Reject</button>
                      </>
                    ) : (
                      <span className="faint">{review.reviewed_by ?? "closed"}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
