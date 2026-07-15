import { useCallback, useEffect, useMemo, useState } from "react";
import { api, getAuthor, type AgentSkillRow, type ProjectRow, type ProjectTypeWithCount, type SkillAssignmentRow, type SkillCandidateRow, type SkillReviewRow, type SkillSourceRow, type SkillSpecLinkRow } from "../api";
import type { SpecSummary } from "@specregistry/shared";
import { StatusBadge, timeAgo } from "../components";

type SkillTab = "installed" | "sources" | "candidates" | "reviews" | "assignments";

function parseList(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function parseArray(value: string): any[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function includesText(...values: Array<string | null | undefined>): (query: string) => boolean {
  const haystack = values.filter(Boolean).join("\n").toLowerCase();
  return (query: string) => !query.trim() || haystack.includes(query.trim().toLowerCase());
}

export default function SkillsMarketplacePage() {
  const [tab, setTab] = useState<SkillTab>("installed");
  const [skills, setSkills] = useState<AgentSkillRow[]>([]);
  const [sources, setSources] = useState<SkillSourceRow[]>([]);
  const [candidates, setCandidates] = useState<SkillCandidateRow[]>([]);
  const [reviews, setReviews] = useState<SkillReviewRow[]>([]);
  const [assignments, setAssignments] = useState<SkillAssignmentRow[]>([]);
  const [skillSpecLinks, setSkillSpecLinks] = useState<SkillSpecLinkRow[]>([]);
  const [specs, setSpecs] = useState<SpecSummary[]>([]);
  const [projectTypes, setProjectTypes] = useState<ProjectTypeWithCount[]>([]);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
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
  const [assignmentSkillId, setAssignmentSkillId] = useState("");
  const [assignmentScope, setAssignmentScope] = useState<SkillAssignmentRow["scope"]>("global");
  const [assignmentProjectTypeId, setAssignmentProjectTypeId] = useState("");
  const [assignmentProjectId, setAssignmentProjectId] = useState("");
  const [scanningSourceId, setScanningSourceId] = useState("");
  const [skillQuery, setSkillQuery] = useState("");
  const [skillRiskFilter, setSkillRiskFilter] = useState<AgentSkillRow["risk_level"] | "all">("all");
  const [skillStatusFilter, setSkillStatusFilter] = useState<AgentSkillRow["status"] | "all">("all");
  const [candidateQuery, setCandidateQuery] = useState("");
  const [candidateTypeFilter, setCandidateTypeFilter] = useState<SkillCandidateRow["candidate_type"] | "all">("all");
  const [candidateGateFilter, setCandidateGateFilter] = useState<SkillCandidateRow["gate_status"] | "all">("all");
  const [candidateStatusFilter, setCandidateStatusFilter] = useState<SkillCandidateRow["status"] | "all">("all");
  const [candidateSourceFilter, setCandidateSourceFilter] = useState("all");
  const [sourceQuery, setSourceQuery] = useState("");
  const [sourceTypeFilter, setSourceTypeFilter] = useState<SkillSourceRow["source_type"] | "all">("all");
  const [sourceTrustFilter, setSourceTrustFilter] = useState<SkillSourceRow["trust_decision"] | "all">("all");
  const [selectedSkillId, setSelectedSkillId] = useState("");
  const [selectedCandidateId, setSelectedCandidateId] = useState("");
  const [selectedSourceId, setSelectedSourceId] = useState("");
  const [linkSpecId, setLinkSpecId] = useState("");
  const [linkRelation, setLinkRelation] = useState<SkillSpecLinkRow["relation"]>("related");
  const [linkSectionAnchor, setLinkSectionAnchor] = useState("");

  const reload = useCallback(() => {
    setError(undefined);
    Promise.all([api.agentSkills(true), api.skillSources(), api.skillCandidates(), api.skillReviews(), api.skillAssignments(), api.skillSpecLinks(), api.specs(), api.projectTypes(), api.projects()])
      .then(([nextSkills, nextSources, nextCandidates, nextReviews, nextAssignments, nextLinks, nextSpecs, nextProjectTypes, nextProjects]) => {
        setSkills(nextSkills);
        setSources(nextSources);
        setCandidates(nextCandidates);
        setReviews(nextReviews);
        setAssignments(nextAssignments);
        setSkillSpecLinks(nextLinks);
        setSpecs(nextSpecs);
        setProjectTypes(nextProjectTypes);
        setProjects(nextProjects);
        const active = nextSkills.find((skill) => skill.status === "active");
        if (!assignmentSkillId && active) setAssignmentSkillId(active.id);
        const reusableTypes = nextProjectTypes.filter((projectType) => projectType.scope === "project_type");
        if (!assignmentProjectTypeId && reusableTypes[0]) setAssignmentProjectTypeId(reusableTypes[0].id);
        if (!assignmentProjectId && nextProjects[0]) setAssignmentProjectId(nextProjects[0].id);
        if (!linkSpecId && nextSpecs[0]) setLinkSpecId(nextSpecs[0].id);
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(reload, [reload]);

  const summary = useMemo(() => {
    const activeSkills = skills.filter((skill) => skill.status === "active").length;
    const openCandidates = candidates.filter((candidate) => candidate.status === "candidate").length;
    const restrictedCandidates = candidates.filter((candidate) => candidate.risk_level === "restricted").length;
    const pendingReviews = reviews.filter((review) => review.status === "pending").length;
    return { activeSkills, openCandidates, restrictedCandidates, pendingReviews, assignments: assignments.length };
  }, [skills, candidates, reviews, assignments]);

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

  async function scanSource(source: SkillSourceRow) {
    setError(undefined);
    setNotice(undefined);
    setScanningSourceId(source.id);
    try {
      const result = await api.scanSkillSource(source.id);
      setNotice(`Scan found ${result.scanned} candidate file${result.scanned === 1 ? "" : "s"}; ${result.created} new, ${result.skipped} already known.`);
      reload();
      setTab("candidates");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setScanningSourceId("");
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

  async function createAssignment() {
    if (!assignmentSkillId) return;
    if (assignmentScope === "project_type" && !assignmentProjectTypeId) return;
    if (assignmentScope === "project" && !assignmentProjectId) return;
    setError(undefined);
    setNotice(undefined);
    try {
      await api.createSkillAssignment({
        skill_id: assignmentSkillId,
        scope: assignmentScope,
        project_type_id: assignmentScope === "project_type" ? assignmentProjectTypeId : undefined,
        project_id: assignmentScope === "project" ? assignmentProjectId : undefined,
      });
      setNotice("Skill assignment saved.");
      reload();
      setTab("assignments");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function deleteAssignment(id: string) {
    setError(undefined);
    setNotice(undefined);
    try {
      await api.deleteSkillAssignment(id);
      setNotice("Skill assignment removed.");
      reload();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function createSpecLink(skill: AgentSkillRow) {
    if (!linkSpecId) return;
    setError(undefined);
    setNotice(undefined);
    try {
      await api.createSkillSpecLink({
        skill_id: skill.id,
        spec_id: linkSpecId,
        relation: linkRelation,
        section_anchor: linkSectionAnchor.trim() || undefined,
      });
      setNotice("Skill spec link saved.");
      setLinkSectionAnchor("");
      reload();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function deleteSpecLink(id: string) {
    setError(undefined);
    setNotice(undefined);
    try {
      await api.deleteSkillSpecLink(id);
      setNotice("Skill spec link removed.");
      reload();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const reusableProjectTypes = projectTypes.filter((projectType) => projectType.scope === "project_type");
  const activeSkills = skills.filter((skill) => skill.status === "active");
  const filteredSkills = skills.filter((skill) => {
    if (skillRiskFilter !== "all" && skill.risk_level !== skillRiskFilter) return false;
    if (skillStatusFilter !== "all" && skill.status !== skillStatusFilter) return false;
    return includesText(skill.name, skill.slug, skill.description, skill.source_url, skill.source_path)(skillQuery);
  });
  const filteredSources = sources.filter((source) => {
    if (sourceTypeFilter !== "all" && source.source_type !== sourceTypeFilter) return false;
    if (sourceTrustFilter !== "all" && source.trust_decision !== sourceTrustFilter) return false;
    return includesText(source.url, source.provider, source.license, source.notes)(sourceQuery);
  });
  const filteredCandidates = candidates.filter((candidate) => {
    if (candidateTypeFilter !== "all" && candidate.candidate_type !== candidateTypeFilter) return false;
    if (candidateGateFilter !== "all" && candidate.gate_status !== candidateGateFilter) return false;
    if (candidateStatusFilter !== "all" && candidate.status !== candidateStatusFilter) return false;
    if (candidateSourceFilter !== "all" && (candidateSourceFilter ? candidate.source_id !== candidateSourceFilter : candidate.source_id)) return false;
    return includesText(
      candidate.proposed_name,
      candidate.proposed_slug,
      candidate.category,
      candidate.source_url,
      candidate.source_path,
      candidate.raw_content,
      candidate.risk_summary,
      candidate.classifier_notes
    )(candidateQuery);
  });
  const selectedSkill = skills.find((skill) => skill.id === selectedSkillId);
  const selectedCandidate = candidates.find((candidate) => candidate.id === selectedCandidateId);
  const selectedSource = sources.find((source) => source.id === selectedSourceId);
  const selectedSkillLinks = selectedSkill ? skillSpecLinks.filter((link) => link.skill_id === selectedSkill.id) : [];

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Skills Marketplace</h1>
          <span className="sub">Governed procedures, external sources, and untrusted candidates for review</span>
        </div>
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
        <div className="card">
          <div className="metric">{summary.assignments}</div>
          <div className="label">Assignments</div>
        </div>
      </div>

      <div className="page-tabs" role="tablist" aria-label="Skill marketplace sections">
        <button className={tab === "installed" ? "active" : ""} onClick={() => setTab("installed")}>Installed</button>
        <button className={tab === "sources" ? "active" : ""} onClick={() => setTab("sources")}>Sources</button>
        <button className={tab === "candidates" ? "active" : ""} onClick={() => setTab("candidates")}>Candidates</button>
        <button className={tab === "reviews" ? "active" : ""} onClick={() => setTab("reviews")}>Reviews</button>
        <button className={tab === "assignments" ? "active" : ""} onClick={() => setTab("assignments")}>Assignments</button>
      </div>

      {tab === "installed" && (
        <div className="section">
          <div className="panel-head">
            <h2>Installed Skills</h2>
            <span className="faint">{filteredSkills.length} of {skills.length}</span>
          </div>
          <div className="filter-panel">
            <div className="form-row">
              <input type="text" placeholder="Search skills" value={skillQuery} onChange={(e) => setSkillQuery(e.target.value)} style={{ flex: 1, minWidth: 260 }} />
              <select value={skillRiskFilter} onChange={(e) => setSkillRiskFilter(e.target.value as AgentSkillRow["risk_level"] | "all")}>
                <option value="all">All risk</option>
                <option value="safe">Safe</option>
                <option value="restricted">Restricted</option>
              </select>
              <select value={skillStatusFilter} onChange={(e) => setSkillStatusFilter(e.target.value as AgentSkillRow["status"] | "all")}>
                <option value="all">All status</option>
                <option value="active">Active</option>
                <option value="disabled">Disabled</option>
              </select>
            </div>
          </div>
          <div className="table-wrap">
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
              {filteredSkills.map((skill) => (
                <tr key={skill.id}>
                  <td><strong>{skill.name}</strong><div className="mono faint">{skill.slug}{skill.built_in ? " · built in" : ""}</div></td>
                  <td><StatusBadge status={skill.risk_level} /></td>
                  <td><StatusBadge status={skill.status} /></td>
                  <td>{skill.description}</td>
                  <td className="faint">{timeAgo(skill.updated_at)}</td>
                  <td>
                    <button onClick={() => setSelectedSkillId(skill.id)}>Details</button>{" "}
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
          {selectedSkill && (
            <div className="detail-panel">
              <div className="form-row" style={{ justifyContent: "space-between" }}>
                <h3 style={{ margin: 0 }}>{selectedSkill.name}</h3>
                <button onClick={() => setSelectedSkillId("")}>Close</button>
              </div>
              <p>{selectedSkill.description}</p>
              <div className="form-row" style={{ marginBottom: 12 }}>
                <span className="mono">{selectedSkill.slug}</span>
                <StatusBadge status={selectedSkill.risk_level} />
                <StatusBadge status={selectedSkill.status} />
                <span className="badge">{selectedSkill.built_in ? "built in" : "custom"}</span>
              </div>
              <div className="mono faint">{selectedSkill.source_url ?? "No external source"}{selectedSkill.source_path ? ` · ${selectedSkill.source_path}` : ""}</div>
              <div style={{ marginTop: 14 }}>
                <h4 style={{ marginBottom: 8 }}>Related Specs</h4>
                <div className="form-row" style={{ marginBottom: 10 }}>
                  <select value={linkSpecId} onChange={(e) => setLinkSpecId(e.target.value)} style={{ minWidth: 280 }}>
                    {specs.map((spec) => (
                      <option key={spec.id} value={spec.id}>{spec.project_type_name}: {spec.filename}</option>
                    ))}
                  </select>
                  <select value={linkRelation} onChange={(e) => setLinkRelation(e.target.value as SkillSpecLinkRow["relation"])}>
                    <option value="related">Related</option>
                    <option value="governs">Governs</option>
                    <option value="recommends">Recommends</option>
                    <option value="supports">Supports</option>
                  </select>
                  <input type="text" placeholder="section anchor" value={linkSectionAnchor} onChange={(e) => setLinkSectionAnchor(e.target.value)} />
                  <button onClick={() => createSpecLink(selectedSkill)} disabled={!linkSpecId}>Link spec</button>
                </div>
                <table className="grid" style={{ marginBottom: 12 }}>
                  <thead>
                    <tr>
                      <th>Spec</th>
                      <th>Relation</th>
                      <th>Section</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedSkillLinks.map((link) => (
                      <tr key={link.id}>
                        <td><strong>{link.filename}</strong><div className="faint">{link.project_type_name} · v{link.current_version}</div></td>
                        <td>{link.relation}</td>
                        <td className="mono">{link.section_anchor ?? "whole spec"}</td>
                        <td><button onClick={() => deleteSpecLink(link.id)}>Remove</button></td>
                      </tr>
                    ))}
                    {selectedSkillLinks.length === 0 && (
                      <tr>
                        <td colSpan={4} className="faint">No related specs linked yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <pre style={{ whiteSpace: "pre-wrap", maxHeight: 320, overflow: "auto" }}>{selectedSkill.instructions}</pre>
            </div>
          )}
        </div>
      )}

      {tab === "sources" && (
        <>
          <div className="filter-panel">
            <div className="panel-head">
              <h2>Add Source</h2>
              <span className="faint">Register external repositories before scanning them.</span>
            </div>
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
          <div className="filter-panel">
            <div className="panel-head">
              <h2>Sources</h2>
              <span className="faint">{filteredSources.length} of {sources.length}</span>
            </div>
            <div className="form-row">
              <input type="text" placeholder="Search sources" value={sourceQuery} onChange={(e) => setSourceQuery(e.target.value)} style={{ flex: 1, minWidth: 260 }} />
              <select value={sourceTypeFilter} onChange={(e) => setSourceTypeFilter(e.target.value as SkillSourceRow["source_type"] | "all")}>
                <option value="all">All types</option>
                <option value="github_repo">GitHub repo</option>
                <option value="github_search">GitHub search</option>
                <option value="local_upload">Local upload</option>
                <option value="builtin_pack">Built-in pack</option>
                <option value="manual">Manual</option>
              </select>
              <select value={sourceTrustFilter} onChange={(e) => setSourceTrustFilter(e.target.value as SkillSourceRow["trust_decision"] | "all")}>
                <option value="all">All trust</option>
                <option value="trusted">Trusted</option>
                <option value="unreviewed">Unreviewed</option>
                <option value="blocked">Blocked</option>
              </select>
            </div>
          </div>
          <div className="table-wrap">
          <table className="grid">
            <thead>
              <tr>
                <th>Source</th>
                <th>Type</th>
                <th>Trust</th>
                <th>Status</th>
                <th>License</th>
                <th>Last scan</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSources.map((source) => (
                <tr key={source.id}>
                  <td className="mono">{source.url}<div className="faint">{source.notes}</div></td>
                  <td>{source.source_type}</td>
                  <td><StatusBadge status={source.trust_decision} /></td>
                  <td><StatusBadge status={source.status} /></td>
                  <td>{source.license ?? "unknown"}</td>
                  <td className="faint">{source.last_scan_at ? timeAgo(source.last_scan_at) : "never"}</td>
                  <td>
                    <button onClick={() => setSelectedSourceId(source.id)}>Details</button>{" "}
                    <button
                      onClick={() => scanSource(source)}
                      disabled={scanningSourceId === source.id || source.source_type !== "github_repo" || source.status !== "active" || source.trust_decision === "blocked"}
                    >
                      {scanningSourceId === source.id ? "Scanning..." : "Scan"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          {selectedSource && (
            <div className="detail-panel">
              <div className="form-row" style={{ justifyContent: "space-between" }}>
                <h3 style={{ margin: 0 }}>Source Details</h3>
                <button onClick={() => setSelectedSourceId("")}>Close</button>
              </div>
              <div className="mono">{selectedSource.url}</div>
              <div className="form-row" style={{ marginTop: 12 }}>
                <span className="badge">{selectedSource.source_type}</span>
                <StatusBadge status={selectedSource.trust_decision} />
                <StatusBadge status={selectedSource.status} />
                <span className="badge">{selectedSource.license ?? "unknown license"}</span>
              </div>
              <p>{selectedSource.notes ?? "No notes recorded."}</p>
              <div className="faint">Last scan: {selectedSource.last_scan_at ? timeAgo(selectedSource.last_scan_at) : "never"}</div>
            </div>
          )}
        </>
      )}

      {tab === "candidates" && (
        <>
          <div className="filter-panel">
            <div className="panel-head">
              <h2>Capture Candidate</h2>
              <span className="faint">Manual imports stay untrusted until review and conversion.</span>
            </div>
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
          <div className="filter-panel">
            <div className="panel-head">
              <h2>Candidates</h2>
              <span className="faint">{filteredCandidates.length} of {candidates.length}</span>
            </div>
            <div className="form-row">
              <input type="text" placeholder="Search candidates" value={candidateQuery} onChange={(e) => setCandidateQuery(e.target.value)} style={{ flex: 1, minWidth: 260 }} />
              <select value={candidateTypeFilter} onChange={(e) => setCandidateTypeFilter(e.target.value as SkillCandidateRow["candidate_type"] | "all")}>
                <option value="all">All types</option>
                <option value="agent_skill">Agent skill</option>
                <option value="spec_seed">Spec seed</option>
                <option value="project_type_template">Project type template</option>
                <option value="reference_only">Reference only</option>
                <option value="unsafe">Unsafe</option>
                <option value="unknown">Unknown</option>
              </select>
              <select value={candidateGateFilter} onChange={(e) => setCandidateGateFilter(e.target.value as SkillCandidateRow["gate_status"] | "all")}>
                <option value="all">All gates</option>
                <option value="pass">Pass</option>
                <option value="review">Review</option>
                <option value="block">Block</option>
                <option value="pending">Pending</option>
              </select>
              <select value={candidateStatusFilter} onChange={(e) => setCandidateStatusFilter(e.target.value as SkillCandidateRow["status"] | "all")}>
                <option value="all">All status</option>
                <option value="candidate">Candidate</option>
                <option value="converted">Converted</option>
                <option value="rejected">Rejected</option>
                <option value="archived">Archived</option>
              </select>
              <select value={candidateSourceFilter} onChange={(e) => setCandidateSourceFilter(e.target.value)}>
                <option value="all">All sources</option>
                <option value="">Manual</option>
                {sources.map((source) => (
                  <option key={source.id} value={source.id}>{source.url}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="table-wrap">
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
              {filteredCandidates.map((candidate) => {
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
                      <button onClick={() => setSelectedCandidateId(candidate.id)}>Details</button>{" "}
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
          </div>
          {selectedCandidate && (
            <div className="detail-panel">
              <div className="form-row" style={{ justifyContent: "space-between" }}>
                <h3 style={{ margin: 0 }}>{selectedCandidate.proposed_name}</h3>
                <button onClick={() => setSelectedCandidateId("")}>Close</button>
              </div>
              <div className="form-row" style={{ marginBottom: 12 }}>
                <span className="badge">{selectedCandidate.candidate_type}</span>
                <StatusBadge status={selectedCandidate.gate_status} />
                <StatusBadge status={selectedCandidate.risk_level} />
                <StatusBadge status={selectedCandidate.status} />
              </div>
              <div className="mono faint">{selectedCandidate.source_path ?? selectedCandidate.source_url ?? "manual"} · {selectedCandidate.raw_content_hash}</div>
              <p>{selectedCandidate.risk_summary}</p>
              <p className="faint">{selectedCandidate.classifier_notes}</p>
              <table className="grid" style={{ marginBottom: 12 }}>
                <thead><tr><th>Gate</th><th>Status</th><th>Detail</th></tr></thead>
                <tbody>
                  {parseArray(selectedCandidate.gate_results).map((parsed, index) => {
                    return (
                      <tr key={index}>
                        <td>{parsed.gate}</td>
                        <td><StatusBadge status={parsed.status} /></td>
                        <td>{parsed.detail}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <pre style={{ whiteSpace: "pre-wrap", maxHeight: 360, overflow: "auto" }}>{selectedCandidate.raw_content}</pre>
            </div>
          )}
        </>
      )}

      {tab === "reviews" && (
        <div className="section">
          <div className="panel-head">
            <h2>Skill Reviews</h2>
            <span className="faint">{reviews.length} total</span>
          </div>
          <div className="table-wrap">
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
        </div>
      )}

      {tab === "assignments" && (
        <div className="section">
          <div className="panel-head">
            <h2>Skill Assignments</h2>
            <span className="faint">{assignments.length} total</span>
          </div>
          <div className="filter-panel">
            <div className="form-row">
              <select value={assignmentSkillId} onChange={(e) => setAssignmentSkillId(e.target.value)}>
                <option value="">Select active skill</option>
                {activeSkills.map((skill) => (
                  <option key={skill.id} value={skill.id}>{skill.name}</option>
                ))}
              </select>
              <select value={assignmentScope} onChange={(e) => setAssignmentScope(e.target.value as SkillAssignmentRow["scope"])}>
                <option value="global">Global</option>
                <option value="project_type">Project type</option>
                <option value="project">Project</option>
              </select>
              {assignmentScope === "project_type" && (
                <select value={assignmentProjectTypeId} onChange={(e) => setAssignmentProjectTypeId(e.target.value)}>
                  {reusableProjectTypes.map((projectType) => (
                    <option key={projectType.id} value={projectType.id}>{projectType.name}</option>
                  ))}
                </select>
              )}
              {assignmentScope === "project" && (
                <select value={assignmentProjectId} onChange={(e) => setAssignmentProjectId(e.target.value)}>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>{project.repo}</option>
                  ))}
                </select>
              )}
              <button
                className="primary"
                onClick={createAssignment}
                disabled={!assignmentSkillId || (assignmentScope === "project_type" && !assignmentProjectTypeId) || (assignmentScope === "project" && !assignmentProjectId)}
              >
                Assign skill
              </button>
            </div>
          </div>
          <div className="table-wrap">
          <table className="grid">
            <thead>
              <tr>
                <th>Skill</th>
                <th>Scope</th>
                <th>Target</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((assignment) => (
                <tr key={assignment.id}>
                  <td><strong>{assignment.skill_name}</strong><div className="mono faint">{assignment.skill_slug}</div></td>
                  <td>{assignment.scope}</td>
                  <td>{assignment.project_repo ?? assignment.project_type_name ?? "All projects"}</td>
                  <td><StatusBadge status={assignment.skill_status} /> <StatusBadge status={assignment.risk_level} /></td>
                  <td>{assignment.created_by}<div className="faint">{timeAgo(assignment.created_at)}</div></td>
                  <td><button onClick={() => deleteAssignment(assignment.id)}>Remove</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </>
  );
}
