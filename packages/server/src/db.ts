import Database from "better-sqlite3";
import crypto from "node:crypto";

export type Db = Database.Database;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS project_types (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  scope TEXT NOT NULL DEFAULT 'project_type' CHECK (scope IN ('global', 'project_type')),
  industry TEXT,
  description TEXT,
  required_reviewers TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS specs (
  id TEXT PRIMARY KEY,
  project_type_id TEXT NOT NULL REFERENCES project_types(id),
  project_id TEXT REFERENCES repo_consumers(id),
  filename TEXT NOT NULL,
  current_version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_review', 'published')),
  content TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  audit_prompt TEXT,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_specs_type_filename ON specs(project_type_id, filename) WHERE project_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_specs_project_filename ON specs(project_id, filename) WHERE project_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS spec_versions (
  id TEXT PRIMARY KEY,
  spec_id TEXT NOT NULL REFERENCES specs(id),
  version TEXT NOT NULL,
  content TEXT NOT NULL,
  published_by TEXT NOT NULL,
  published_at TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'stable',
  UNIQUE (spec_id, version)
);

CREATE TABLE IF NOT EXISTS change_requests (
  id TEXT PRIMARY KEY,
  spec_id TEXT NOT NULL REFERENCES specs(id),
  proposed_by TEXT NOT NULL,
  version_delta TEXT NOT NULL CHECK (version_delta IN ('major', 'minor', 'patch')),
  diff TEXT NOT NULL,
  proposed_content TEXT NOT NULL,
  summary TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by TEXT,
  reviewed_at TEXT,
  resulting_version TEXT,
  compatibility TEXT,
  lint TEXT,
  contradictions TEXT,
  risk TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS review_approvals (
  id TEXT PRIMARY KEY,
  change_request_id TEXT NOT NULL REFERENCES change_requests(id),
  reviewer TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (change_request_id, reviewer)
);

CREATE TABLE IF NOT EXISTS approval_policies (
  id TEXT PRIMARY KEY,
  project_type_id TEXT REFERENCES project_types(id),
  filename_glob TEXT NOT NULL DEFAULT '*',
  min_approvals INTEGER NOT NULL DEFAULT 1 CHECK (min_approvals >= 1),
  required_reviewers TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- spec_id/spec_version are nullable: a 'missing_guidance' report flags a coverage
-- gap (no governing spec exists yet) rather than a problem with an existing one.
CREATE TABLE IF NOT EXISTS agent_feedback (
  id TEXT PRIMARY KEY,
  spec_id TEXT REFERENCES specs(id),
  spec_version TEXT,
  agent_identifier TEXT NOT NULL,
  error_type TEXT NOT NULL CHECK (error_type IN ('ambiguity', 'contradiction', 'outdated', 'missing_guidance')),
  context_code_snippet TEXT,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved')),
  project_type_id TEXT REFERENCES project_types(id),
  languages TEXT,
  topic TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS stub_prompts (
  id TEXT PRIMARY KEY,
  target_filename TEXT NOT NULL,
  template TEXT NOT NULL,
  description TEXT,
  project_type_id TEXT REFERENCES project_types(id),
  UNIQUE (target_filename, project_type_id)
);

CREATE TABLE IF NOT EXISTS spec_templates (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL UNIQUE,
  required_sections TEXT NOT NULL DEFAULT '[]',
  content_template TEXT NOT NULL DEFAULT '',
  description TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS usage_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL CHECK (event_type IN ('download', 'agent_read', 'search', 'stub_prompts', 'sync_check')),
  project_type_id TEXT,
  detail TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_usage_events_type_time ON usage_events(event_type, created_at);

CREATE TABLE IF NOT EXISTS webhooks (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  events TEXT NOT NULL DEFAULT '[]',
  format TEXT NOT NULL DEFAULT 'json' CHECK (format IN ('json', 'slack', 'gchat')),
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS repo_subscriptions (
  id TEXT PRIMARY KEY,
  project_type_id TEXT NOT NULL REFERENCES project_types(id),
  repo TEXT NOT NULL,
  branch TEXT NOT NULL DEFAULT 'main',
  base_path TEXT NOT NULL DEFAULT 'specs',
  created_at TEXT NOT NULL,
  UNIQUE (project_type_id, repo)
);

CREATE TABLE IF NOT EXISTS sync_jobs (
  id TEXT PRIMARY KEY,
  subscription_id TEXT NOT NULL REFERENCES repo_subscriptions(id),
  spec_id TEXT NOT NULL REFERENCES specs(id),
  version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done', 'error')),
  detail TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS repo_consumers (
  id TEXT PRIMARY KEY,
  repo TEXT NOT NULL,
  branch TEXT,
  commit_sha TEXT,
  project_type_id TEXT NOT NULL REFERENCES project_types(id),
  specs_path TEXT NOT NULL DEFAULT 'specs',
  manifest_path TEXT NOT NULL DEFAULT 'specs/.specregistry.json',
  source TEXT NOT NULL DEFAULT 'cli',
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  UNIQUE (repo, project_type_id)
);

CREATE TABLE IF NOT EXISTS repo_consumer_specs (
  consumer_id TEXT NOT NULL REFERENCES repo_consumers(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  version TEXT NOT NULL,
  project_type TEXT,
  sha256 TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (consumer_id, filename)
);

CREATE TABLE IF NOT EXISTS code_trace_reports (
  id TEXT PRIMARY KEY,
  consumer_id TEXT NOT NULL REFERENCES repo_consumers(id) ON DELETE CASCADE,
  generated_at TEXT NOT NULL,
  specs_dir TEXT NOT NULL DEFAULT 'specs',
  spec_count INTEGER NOT NULL DEFAULT 0,
  entity_count INTEGER NOT NULL DEFAULT 0,
  governed_entity_count INTEGER NOT NULL DEFAULT 0,
  linked_entity_count INTEGER NOT NULL DEFAULT 0,
  unlinked_entity_count INTEGER NOT NULL DEFAULT 0,
  coverage_ratio REAL NOT NULL DEFAULT 0,
  drift_score REAL NOT NULL DEFAULT 0,
  drift_severity TEXT NOT NULL DEFAULT 'none',
  aliases_count INTEGER NOT NULL DEFAULT 0,
  unlinked_sample TEXT NOT NULL DEFAULT '[]',
  raw_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_code_trace_reports_consumer_time ON code_trace_reports(consumer_id, created_at);

CREATE TABLE IF NOT EXISTS code_trace_links (
  report_id TEXT NOT NULL REFERENCES code_trace_reports(id) ON DELETE CASCADE,
  entity_id TEXT NOT NULL,
  entity_path TEXT,
  entity_name TEXT NOT NULL,
  entity_kind TEXT NOT NULL,
  spec_filename TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 0,
  reasons TEXT NOT NULL DEFAULT '[]',
  PRIMARY KEY (report_id, entity_id, spec_filename)
);
CREATE INDEX IF NOT EXISTS idx_code_trace_links_report ON code_trace_links(report_id);

CREATE VIRTUAL TABLE IF NOT EXISTS spec_chunks USING fts5(
  spec_id UNINDEXED,
  section,
  content
);

CREATE TABLE IF NOT EXISTS spec_embeddings (
  spec_id TEXT NOT NULL REFERENCES specs(id) ON DELETE CASCADE,
  section TEXT NOT NULL,
  section_anchor TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  dimensions INTEGER NOT NULL,
  vector TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (spec_id, section_anchor, provider, model)
);
CREATE INDEX IF NOT EXISTS idx_spec_embeddings_provider_model ON spec_embeddings(provider, model);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  display_name TEXT,
  role TEXT NOT NULL DEFAULT 'author' CHECK (role IN ('admin', 'reviewer', 'author', 'agent')),
  password_hash TEXT,
  source TEXT NOT NULL DEFAULT 'local' CHECK (source IN ('local', 'ldap')),
  repo TEXT,
  project_type_id TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tokens (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL REFERENCES users(id),
  name TEXT,
  created_at TEXT NOT NULL,
  last_used_at TEXT,
  expires_at TEXT
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS efficacy_runs (
  id TEXT PRIMARY KEY,
  spec_id TEXT NOT NULL REFERENCES specs(id),
  task_prompt TEXT NOT NULL,
  score_with INTEGER NOT NULL,
  score_without INTEGER NOT NULL,
  improved INTEGER NOT NULL,
  rationale TEXT NOT NULL,
  model TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  summary TEXT NOT NULL,
  detail TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_log_time ON audit_log(created_at);

CREATE TABLE IF NOT EXISTS agent_skills (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  instructions TEXT NOT NULL,
  risk_level TEXT NOT NULL DEFAULT 'safe' CHECK (risk_level IN ('safe', 'restricted')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  built_in INTEGER NOT NULL DEFAULT 0,
  source_candidate_id TEXT REFERENCES skill_candidates(id),
  source_url TEXT,
  source_path TEXT,
  source_commit TEXT,
  imported_at TEXT,
  transformed_by TEXT,
  transformation_note TEXT,
  upstream_content_hash TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_skill_versions (
  id TEXT PRIMARY KEY,
  skill_id TEXT NOT NULL REFERENCES agent_skills(id) ON DELETE CASCADE,
  version TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  instructions TEXT NOT NULL,
  risk_level TEXT NOT NULL CHECK (risk_level IN ('safe', 'restricted')),
  status TEXT NOT NULL CHECK (status IN ('active', 'disabled')),
  published_by TEXT NOT NULL,
  changelog TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  UNIQUE(skill_id, version),
  UNIQUE(skill_id, content_hash)
);
CREATE INDEX IF NOT EXISTS idx_agent_skill_versions_skill ON agent_skill_versions(skill_id, created_at);

CREATE TABLE IF NOT EXISTS skill_change_requests (
  id TEXT PRIMARY KEY,
  skill_id TEXT NOT NULL REFERENCES agent_skills(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('update', 'enable', 'disable', 'delete')),
  current_name TEXT NOT NULL,
  current_description TEXT NOT NULL,
  current_instructions TEXT NOT NULL,
  current_risk_level TEXT NOT NULL,
  current_status TEXT NOT NULL,
  proposed_name TEXT NOT NULL,
  proposed_description TEXT NOT NULL,
  proposed_instructions TEXT NOT NULL,
  proposed_risk_level TEXT NOT NULL,
  proposed_status TEXT NOT NULL,
  summary TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  proposed_by TEXT NOT NULL,
  reviewed_by TEXT,
  reviewed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_skill_change_requests_status ON skill_change_requests(status, created_at);
CREATE INDEX IF NOT EXISTS idx_skill_change_requests_skill ON skill_change_requests(skill_id, created_at);

CREATE TABLE IF NOT EXISTS skill_assignments (
  id TEXT PRIMARY KEY,
  skill_id TEXT NOT NULL REFERENCES agent_skills(id) ON DELETE CASCADE,
  scope TEXT NOT NULL CHECK (scope IN ('global', 'project_type', 'project')),
  project_type_id TEXT REFERENCES project_types(id),
  project_id TEXT REFERENCES repo_consumers(id),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(skill_id, scope, project_type_id, project_id)
);
CREATE INDEX IF NOT EXISTS idx_skill_assignments_scope ON skill_assignments(scope, project_type_id, project_id);

CREATE TABLE IF NOT EXISTS skill_spec_links (
  id TEXT PRIMARY KEY,
  skill_id TEXT NOT NULL REFERENCES agent_skills(id) ON DELETE CASCADE,
  spec_id TEXT NOT NULL REFERENCES specs(id) ON DELETE CASCADE,
  section_anchor TEXT,
  relation TEXT NOT NULL DEFAULT 'related' CHECK (relation IN ('related', 'governs', 'recommends', 'supports')),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(skill_id, spec_id, section_anchor, relation)
);
CREATE INDEX IF NOT EXISTS idx_skill_spec_links_skill ON skill_spec_links(skill_id);
CREATE INDEX IF NOT EXISTS idx_skill_spec_links_spec ON skill_spec_links(spec_id);

CREATE TABLE IF NOT EXISTS skill_sources (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL UNIQUE,
  provider TEXT NOT NULL DEFAULT 'github',
  source_type TEXT NOT NULL DEFAULT 'github_repo' CHECK (source_type IN ('github_repo', 'github_search', 'local_upload', 'builtin_pack', 'manual')),
  license TEXT,
  default_branch TEXT,
  last_fetched_commit TEXT,
  last_scan_at TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
  trust_decision TEXT NOT NULL DEFAULT 'unreviewed' CHECK (trust_decision IN ('trusted', 'unreviewed', 'blocked')),
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_skill_sources_status ON skill_sources(status, trust_decision);

CREATE TABLE IF NOT EXISTS skill_candidates (
  id TEXT PRIMARY KEY,
  source_id TEXT REFERENCES skill_sources(id) ON DELETE SET NULL,
  source_url TEXT,
  source_path TEXT,
  source_commit TEXT,
  detected_format TEXT NOT NULL DEFAULT 'unknown',
  raw_content_hash TEXT NOT NULL,
  raw_content TEXT NOT NULL,
  license TEXT,
  category TEXT,
  candidate_type TEXT NOT NULL DEFAULT 'unknown' CHECK (candidate_type IN ('agent_skill', 'spec_seed', 'project_type_template', 'reference_only', 'unsafe', 'unknown')),
  proposed_name TEXT NOT NULL,
  proposed_slug TEXT NOT NULL,
  risk_level TEXT NOT NULL DEFAULT 'safe' CHECK (risk_level IN ('safe', 'restricted')),
  risk_summary TEXT NOT NULL DEFAULT '',
  detected_commands TEXT NOT NULL DEFAULT '[]',
  detected_network TEXT NOT NULL DEFAULT '[]',
  detected_secrets TEXT NOT NULL DEFAULT '[]',
  gate_status TEXT NOT NULL DEFAULT 'pending' CHECK (gate_status IN ('pass', 'review', 'block', 'pending')),
  gate_results TEXT NOT NULL DEFAULT '[]',
  classifier_notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'candidate' CHECK (status IN ('candidate', 'converted', 'rejected', 'archived')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_skill_candidates_source ON skill_candidates(source_id, status);
CREATE INDEX IF NOT EXISTS idx_skill_candidates_type ON skill_candidates(candidate_type, status);

CREATE TABLE IF NOT EXISTS harness_proposals (
  id TEXT PRIMARY KEY,
  pattern_key TEXT NOT NULL,
  title TEXT NOT NULL,
  rationale TEXT NOT NULL,
  target_type TEXT NOT NULL DEFAULT 'agent_skill' CHECK (target_type IN ('agent_skill')),
  target_id TEXT NOT NULL REFERENCES agent_skills(id),
  target_slug TEXT NOT NULL,
  current_instructions TEXT NOT NULL,
  proposed_instructions TEXT NOT NULL,
  proposed_addition TEXT NOT NULL,
  validation_gate TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  proposed_by TEXT NOT NULL,
  reviewed_by TEXT,
  reviewed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_harness_proposals_status_time ON harness_proposals(status, created_at);

CREATE TABLE IF NOT EXISTS compliance_policies (
  id TEXT PRIMARY KEY,
  project_type_id TEXT UNIQUE,
  min_coverage REAL NOT NULL DEFAULT 0.8,
  max_drift REAL NOT NULL DEFAULT 0.2,
  required_mapped_kinds TEXT NOT NULL DEFAULT '["route","schema"]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS compliance_attestations (
  id TEXT PRIMARY KEY,
  project_type_id TEXT,
  consumer_id TEXT,
  repo TEXT,
  self_assessed_score INTEGER,
  objective_score INTEGER NOT NULL,
  compliant INTEGER NOT NULL,
  coverage_ratio REAL,
  drift_score REAL,
  outstanding TEXT NOT NULL DEFAULT '[]',
  iteration INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_compliance_attestations_repo ON compliance_attestations(repo, created_at);

CREATE TABLE IF NOT EXISTS agent_sessions (
  id TEXT PRIMARY KEY,
  agent_identifier TEXT NOT NULL,
  project_type_id TEXT,
  consumer_id TEXT,
  repo TEXT,
  branch TEXT,
  task TEXT NOT NULL,
  model TEXT,
  mcp_server TEXT,
  spec_count INTEGER NOT NULL DEFAULT 0,
  spec_bundle TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'blocked')),
  plan TEXT,
  preflight_summary TEXT,
  completion_summary TEXT,
  compliance_attestation_id TEXT,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_repo_time ON agent_sessions(repo, started_at);

CREATE TABLE IF NOT EXISTS context_events (
  id TEXT PRIMARY KEY,
  project_type_id TEXT REFERENCES project_types(id),
  consumer_id TEXT REFERENCES repo_consumers(id),
  repo TEXT,
  agent_session_id TEXT REFERENCES agent_sessions(id),
  event_type TEXT NOT NULL,
  source TEXT,
  detail TEXT,
  actor TEXT,
  estimated_tokens INTEGER NOT NULL DEFAULT 0,
  section_count INTEGER NOT NULL DEFAULT 0,
  tokenizer TEXT NOT NULL DEFAULT 'chars/4:v1',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_context_events_project ON context_events(consumer_id, created_at);
CREATE INDEX IF NOT EXISTS idx_context_events_type ON context_events(project_type_id, created_at);
CREATE INDEX IF NOT EXISTS idx_context_events_session ON context_events(agent_session_id, created_at);

CREATE TABLE IF NOT EXISTS context_event_sections (
  id TEXT PRIMARY KEY,
  context_event_id TEXT NOT NULL REFERENCES context_events(id) ON DELETE CASCADE,
  spec_id TEXT NOT NULL REFERENCES specs(id),
  spec_version TEXT,
  filename TEXT NOT NULL,
  section_title TEXT NOT NULL,
  section_anchor TEXT NOT NULL,
  chars INTEGER NOT NULL DEFAULT 0,
  estimated_tokens INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_context_event_sections_event ON context_event_sections(context_event_id);
CREATE INDEX IF NOT EXISTS idx_context_event_sections_spec ON context_event_sections(spec_id, section_anchor);

CREATE TABLE IF NOT EXISTS llm_usage_reports (
  id TEXT PRIMARY KEY,
  project_type_id TEXT REFERENCES project_types(id),
  consumer_id TEXT REFERENCES repo_consumers(id),
  repo TEXT,
  agent_session_id TEXT REFERENCES agent_sessions(id),
  provider TEXT,
  model TEXT,
  route TEXT,
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  cached_tokens INTEGER NOT NULL DEFAULT 0,
  input_cost_usd REAL,
  output_cost_usd REAL,
  total_cost_usd REAL,
  latency_ms INTEGER,
  related_context_event_ids TEXT NOT NULL DEFAULT '[]',
  detail TEXT,
  actor TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_llm_usage_project ON llm_usage_reports(consumer_id, created_at);
CREATE INDEX IF NOT EXISTS idx_llm_usage_type ON llm_usage_reports(project_type_id, created_at);
CREATE INDEX IF NOT EXISTS idx_llm_usage_session ON llm_usage_reports(agent_session_id, created_at);

CREATE TABLE IF NOT EXISTS audit_reports (
  id TEXT PRIMARY KEY,
  report_type TEXT NOT NULL CHECK (report_type IN ('project_governance', 'spec_quality', 'agent_run', 'release', 'registry_operations')),
  subject_type TEXT NOT NULL CHECK (subject_type IN ('project', 'spec', 'agent_session', 'release', 'registry')),
  subject_id TEXT,
  subject_label TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pass', 'warning', 'fail', 'unknown')),
  summary TEXT NOT NULL,
  evidence_json TEXT NOT NULL,
  markdown TEXT NOT NULL,
  llm_summary TEXT,
  generated_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_reports_subject ON audit_reports(subject_type, subject_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_reports_type_time ON audit_reports(report_type, created_at);
`;

/** Versioned migrations for databases created before the current schema. Each runs once. */
const MIGRATIONS: Array<{ version: number; sql: string }> = [
  { version: 1, sql: "ALTER TABLE change_requests ADD COLUMN compatibility TEXT" },
  { version: 2, sql: "ALTER TABLE change_requests ADD COLUMN lint TEXT" },
  { version: 3, sql: "ALTER TABLE spec_versions ADD COLUMN channel TEXT NOT NULL DEFAULT 'stable'" },
  { version: 4, sql: "ALTER TABLE project_types ADD COLUMN required_reviewers TEXT NOT NULL DEFAULT '[]'" },
  {
    // Widen the webhook format CHECK to admit 'gchat' (SQLite requires a rebuild).
    version: 5,
    sql: `
      ALTER TABLE webhooks RENAME TO webhooks_old;
      CREATE TABLE webhooks (
        id TEXT PRIMARY KEY,
        url TEXT NOT NULL,
        events TEXT NOT NULL DEFAULT '[]',
        format TEXT NOT NULL DEFAULT 'json' CHECK (format IN ('json', 'slack', 'gchat')),
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL
      );
      INSERT INTO webhooks SELECT * FROM webhooks_old;
      DROP TABLE webhooks_old;
    `,
  },
  {
    version: 6,
    sql: `
      CREATE TABLE IF NOT EXISTS review_approvals (
        id TEXT PRIMARY KEY,
        change_request_id TEXT NOT NULL REFERENCES change_requests(id),
        reviewer TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE (change_request_id, reviewer)
      );
    `,
  },
  {
    version: 7,
    sql: `
      CREATE TABLE IF NOT EXISTS approval_policies (
        id TEXT PRIMARY KEY,
        project_type_id TEXT REFERENCES project_types(id),
        filename_glob TEXT NOT NULL DEFAULT '*',
        min_approvals INTEGER NOT NULL DEFAULT 1 CHECK (min_approvals >= 1),
        required_reviewers TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `,
  },
  {
    version: 8,
    sql: `
      CREATE TABLE IF NOT EXISTS audit_log (
        id TEXT PRIMARY KEY,
        actor TEXT NOT NULL,
        action TEXT NOT NULL,
        target_type TEXT,
        target_id TEXT,
        summary TEXT NOT NULL,
        detail TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_audit_log_time ON audit_log(created_at);
    `,
  },
  { version: 9, sql: "ALTER TABLE change_requests ADD COLUMN contradictions TEXT" },
  {
    version: 10,
    sql: `
      CREATE TABLE IF NOT EXISTS repo_consumers (
        id TEXT PRIMARY KEY,
        repo TEXT NOT NULL,
        branch TEXT,
        commit_sha TEXT,
        project_type_id TEXT NOT NULL REFERENCES project_types(id),
        specs_path TEXT NOT NULL DEFAULT 'specs',
        manifest_path TEXT NOT NULL DEFAULT 'specs/.specregistry.json',
        source TEXT NOT NULL DEFAULT 'cli',
        first_seen_at TEXT NOT NULL,
        last_seen_at TEXT NOT NULL,
        UNIQUE (repo, project_type_id)
      );
      CREATE TABLE IF NOT EXISTS repo_consumer_specs (
        consumer_id TEXT NOT NULL REFERENCES repo_consumers(id) ON DELETE CASCADE,
        filename TEXT NOT NULL,
        version TEXT NOT NULL,
        project_type TEXT,
        sha256 TEXT,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (consumer_id, filename)
      );
    `,
  },
  {
    version: 11,
    sql: `
      PRAGMA foreign_keys = OFF;
      DROP TABLE IF EXISTS specs_new;
      CREATE TABLE specs_new (
        id TEXT PRIMARY KEY,
        project_type_id TEXT NOT NULL REFERENCES project_types(id),
        project_id TEXT REFERENCES repo_consumers(id),
        filename TEXT NOT NULL,
        current_version TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_review', 'published')),
        content TEXT NOT NULL,
        updated_by TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      INSERT INTO specs_new
        (id, project_type_id, project_id, filename, current_version, status, content, updated_by, created_at, updated_at)
        SELECT id, project_type_id, NULL, filename, current_version, status, content, updated_by, created_at, updated_at
        FROM specs;
      DROP TABLE specs;
      ALTER TABLE specs_new RENAME TO specs;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_specs_type_filename ON specs(project_type_id, filename) WHERE project_id IS NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_specs_project_filename ON specs(project_id, filename) WHERE project_id IS NOT NULL;
      PRAGMA foreign_keys = ON;
    `,
  },
  { version: 12, sql: "ALTER TABLE change_requests ADD COLUMN risk TEXT" },
  {
    version: 13,
    sql: `
      CREATE TABLE IF NOT EXISTS spec_embeddings (
        spec_id TEXT NOT NULL REFERENCES specs(id) ON DELETE CASCADE,
        section TEXT NOT NULL,
        section_anchor TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        provider TEXT NOT NULL,
        model TEXT NOT NULL,
        dimensions INTEGER NOT NULL,
        vector TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (spec_id, section_anchor, provider, model)
      );
      CREATE INDEX IF NOT EXISTS idx_spec_embeddings_provider_model ON spec_embeddings(provider, model);
    `,
  },
  {
    version: 14,
    sql: `
      CREATE TABLE IF NOT EXISTS agent_skills (
        id TEXT PRIMARY KEY,
        slug TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        instructions TEXT NOT NULL,
        risk_level TEXT NOT NULL DEFAULT 'safe' CHECK (risk_level IN ('safe', 'restricted')),
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
        built_in INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `,
  },
  {
    version: 15,
    sql: "ALTER TABLE specs ADD COLUMN audit_prompt TEXT"
  },
  {
    version: 16,
    sql: "ALTER TABLE specs ADD COLUMN deleted_at TEXT"
  },
  {
    version: 17,
    sql: `
      CREATE TABLE IF NOT EXISTS code_trace_reports (
        id TEXT PRIMARY KEY,
        consumer_id TEXT NOT NULL REFERENCES repo_consumers(id) ON DELETE CASCADE,
        generated_at TEXT NOT NULL,
        specs_dir TEXT NOT NULL DEFAULT 'specs',
        spec_count INTEGER NOT NULL DEFAULT 0,
        entity_count INTEGER NOT NULL DEFAULT 0,
        governed_entity_count INTEGER NOT NULL DEFAULT 0,
        linked_entity_count INTEGER NOT NULL DEFAULT 0,
        unlinked_entity_count INTEGER NOT NULL DEFAULT 0,
        coverage_ratio REAL NOT NULL DEFAULT 0,
        drift_score REAL NOT NULL DEFAULT 0,
        drift_severity TEXT NOT NULL DEFAULT 'none',
        aliases_count INTEGER NOT NULL DEFAULT 0,
        unlinked_sample TEXT NOT NULL DEFAULT '[]',
        raw_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_code_trace_reports_consumer_time ON code_trace_reports(consumer_id, created_at);
      CREATE TABLE IF NOT EXISTS code_trace_links (
        report_id TEXT NOT NULL REFERENCES code_trace_reports(id) ON DELETE CASCADE,
        entity_id TEXT NOT NULL,
        entity_name TEXT NOT NULL,
        entity_kind TEXT NOT NULL,
        spec_filename TEXT NOT NULL,
        confidence REAL NOT NULL DEFAULT 0,
        reasons TEXT NOT NULL DEFAULT '[]',
        PRIMARY KEY (report_id, entity_id, spec_filename)
      );
      CREATE INDEX IF NOT EXISTS idx_code_trace_links_report ON code_trace_links(report_id);
    `,
  },
  {
    // Bind self-enrolled agent identities to a repo + project type so they can
    // self-publish project-scoped specs for their own repo only.
    version: 18,
    sql: `
      ALTER TABLE users ADD COLUMN repo TEXT;
      ALTER TABLE users ADD COLUMN project_type_id TEXT;
    `,
  },
  {
    // Compliance verification loop: per-project-type thresholds + attestation log.
    version: 19,
    sql: `
      CREATE TABLE IF NOT EXISTS compliance_policies (
        id TEXT PRIMARY KEY,
        project_type_id TEXT UNIQUE,
        min_coverage REAL NOT NULL DEFAULT 0.8,
        max_drift REAL NOT NULL DEFAULT 0.2,
        required_mapped_kinds TEXT NOT NULL DEFAULT '["route","schema"]',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS compliance_attestations (
        id TEXT PRIMARY KEY,
        project_type_id TEXT,
        consumer_id TEXT,
        repo TEXT,
        self_assessed_score INTEGER,
        objective_score INTEGER NOT NULL,
        compliant INTEGER NOT NULL,
        coverage_ratio REAL,
        drift_score REAL,
        outstanding TEXT NOT NULL DEFAULT '[]',
        iteration INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_compliance_attestations_repo ON compliance_attestations(repo, created_at);
    `,
  },
  {
    // Agent lifecycle registry for MCP begin_task / finish_task control points.
    version: 20,
    sql: `
      CREATE TABLE IF NOT EXISTS agent_sessions (
        id TEXT PRIMARY KEY,
        agent_identifier TEXT NOT NULL,
        project_type_id TEXT,
        consumer_id TEXT,
        repo TEXT,
        branch TEXT,
        task TEXT NOT NULL,
        model TEXT,
        mcp_server TEXT,
        spec_count INTEGER NOT NULL DEFAULT 0,
        spec_bundle TEXT NOT NULL DEFAULT '[]',
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'blocked')),
        plan TEXT,
        preflight_summary TEXT,
        completion_summary TEXT,
        compliance_attestation_id TEXT,
        started_at TEXT NOT NULL,
        completed_at TEXT,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_agent_sessions_repo_time ON agent_sessions(repo, started_at);
    `,
  },
  {
    // Widen agent_feedback to admit spec_id-less "missing_guidance" gap reports
    // (SQLite requires a rebuild to relax NOT NULL and widen the error_type CHECK).
    version: 21,
    sql: `
      ALTER TABLE agent_feedback RENAME TO agent_feedback_old;
      CREATE TABLE agent_feedback (
        id TEXT PRIMARY KEY,
        spec_id TEXT REFERENCES specs(id),
        spec_version TEXT,
        agent_identifier TEXT NOT NULL,
        error_type TEXT NOT NULL CHECK (error_type IN ('ambiguity', 'contradiction', 'outdated', 'missing_guidance')),
        context_code_snippet TEXT,
        description TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved')),
        project_type_id TEXT REFERENCES project_types(id),
        languages TEXT,
        topic TEXT,
        created_at TEXT NOT NULL
      );
      INSERT INTO agent_feedback
        (id, spec_id, spec_version, agent_identifier, error_type, context_code_snippet, description, status, created_at)
        SELECT id, spec_id, spec_version, agent_identifier, error_type, context_code_snippet, description, status, created_at
        FROM agent_feedback_old;
      DROP TABLE agent_feedback_old;
    `,
  },
  {
    // Correct the built-in load-governed-specs skill so it points agents at begin_task
    // first (matching the AGENT_OPERATING_RULES governed spec). Gated on the exact old
    // shipped text so an admin who has customized this built-in skill keeps their edit.
    // New default skills added alongside this ship via seedDefaultAgentSkills (INSERT
    // OR IGNORE), which runs on every startup.
    version: 22,
    sql: `
      UPDATE agent_skills
      SET instructions = 'Before non-trivial work, call begin_task to register the session, then use the SpecRegistry MCP get_specs tool for the configured project type and repository to load the governed bundle. Check the local manifest for drift. Treat published specs as authoritative and do not treat drafts as approved guidance.',
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE slug = 'load-governed-specs'
        AND built_in = 1
        AND instructions = 'Before non-trivial work, use the SpecRegistry MCP get_specs tool for the configured project type and repository. Check the local manifest for drift. Treat published specs as authoritative and do not treat drafts as approved guidance.';
    `,
  },
  {
    version: 23,
    sql: "ALTER TABLE agent_feedback ADD COLUMN project_type_id TEXT REFERENCES project_types(id)",
  },
  {
    version: 24,
    sql: "ALTER TABLE agent_feedback ADD COLUMN languages TEXT",
  },
  {
    version: 25,
    sql: "ALTER TABLE agent_feedback ADD COLUMN topic TEXT",
  },
  {
    version: 26,
    sql: `
      CREATE TABLE IF NOT EXISTS harness_proposals (
        id TEXT PRIMARY KEY,
        pattern_key TEXT NOT NULL,
        title TEXT NOT NULL,
        rationale TEXT NOT NULL,
        target_type TEXT NOT NULL DEFAULT 'agent_skill' CHECK (target_type IN ('agent_skill')),
        target_id TEXT NOT NULL REFERENCES agent_skills(id),
        target_slug TEXT NOT NULL,
        current_instructions TEXT NOT NULL,
        proposed_instructions TEXT NOT NULL,
        proposed_addition TEXT NOT NULL,
        validation_gate TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
        proposed_by TEXT NOT NULL,
        reviewed_by TEXT,
        reviewed_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_harness_proposals_status_time ON harness_proposals(status, created_at);
    `,
  },
  {
    version: 27,
    sql: "ALTER TABLE tokens ADD COLUMN expires_at TEXT",
  },
  {
    // Tighten the built-in compliance-loop skill so agents halt when objective
    // registry compliance cannot be verified. Gated on the exact shipped text so
    // customized built-in skills keep local edits.
    version: 28,
    sql: `
      UPDATE agent_skills
      SET instructions = 'Before declaring a task done, call finish_task with your session_id (or check_compliance, or run specreg comply for CLI/CI). If it is not compliant, keep remediating and re-run -- a self-assessed ''done'' is not sufficient. If finish_task, check_compliance, or specreg comply cannot run because MCP or the SpecRegistry server appears unavailable, halt and notify the user with the exact tool or command output. Do not report completion while objective compliance is failing or unavailable.',
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE slug = 'run-compliance-loop'
        AND built_in = 1
        AND instructions = 'Before declaring a task done, call finish_task with your session_id (or check_compliance, or run specreg comply for CLI/CI). If it is not compliant, keep remediating and re-run — a self-assessed ''done'' is not sufficient. Do not report completion while the objective coverage/drift gate still reports outstanding items.';
    `,
  },
  {
    // Tighten compliance remediation so agents do not spam broad @spec annotations
    // after repeated failing compliance loops. Gated on the v28 shipped text.
    version: 29,
    sql: `
      UPDATE agent_skills
      SET instructions = 'Before declaring a task done, call finish_task with your session_id (or check_compliance, or run specreg comply for CLI/CI). If it is not compliant, remediate with targeted evidence only: add @spec[FILE#section] annotations only when the code entity is truly governed by that exact section, and never blanket-map files to PROJECT_PROFILE.md or broad requirements just to raise coverage. If no section governs the behavior, report missing_guidance or propose the needed spec. If repeated compliance attempts still fail, halt autonomous remediation and show the user the exact latest output. Do not report completion while objective compliance is failing or unavailable.',
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE slug = 'run-compliance-loop'
        AND built_in = 1
        AND instructions = 'Before declaring a task done, call finish_task with your session_id (or check_compliance, or run specreg comply for CLI/CI). If it is not compliant, keep remediating and re-run -- a self-assessed ''done'' is not sufficient. If finish_task, check_compliance, or specreg comply cannot run because MCP or the SpecRegistry server appears unavailable, halt and notify the user with the exact tool or command output. Do not report completion while objective compliance is failing or unavailable.';
    `,
  },
  {
    // Require compact compliance evidence in implementation commit messages.
    // Gated on shipped built-in text so customized skills remain untouched.
    version: 30,
    sql: `
      UPDATE agent_skills
      SET instructions = 'Summarize commands run, test outcomes, affected specs, known residual risks, and any unverified requirement. Before creating a git commit for implementation work, include compact compliance evidence in the commit message body: the SpecRegistry-Compliance, SpecRegistry-Signals, and SpecRegistry-Command trailer emitted by specreg comply, or equivalent finish_task evidence with verdict, objective score, and session id. Do not claim a check passed unless it was actually executed and its result observed.',
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE slug = 'collect-delivery-evidence'
        AND built_in = 1
        AND instructions = 'Summarize commands run, test outcomes, affected specs, known residual risks, and any unverified requirement. Do not claim a check passed unless it was actually executed and its result observed.';

      UPDATE agent_skills
      SET instructions = 'Before declaring a task done, call finish_task with your session_id (or check_compliance, or run specreg comply for CLI/CI). If it is not compliant, remediate with targeted evidence only: add @spec[FILE#section] annotations only when the code entity is truly governed by that exact section, and never blanket-map files to PROJECT_PROFILE.md or broad requirements just to raise coverage. If no section governs the behavior, report missing_guidance or propose the needed spec. If repeated compliance attempts still fail, halt autonomous remediation and show the user the exact latest output. Before creating a git commit for implementation work, include the compact SpecRegistry-Compliance/SpecRegistry-Signals/SpecRegistry-Command trailer emitted by specreg comply, or equivalent finish_task evidence. Do not report completion while objective compliance is failing or unavailable.',
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE slug = 'run-compliance-loop'
        AND built_in = 1
        AND instructions = 'Before declaring a task done, call finish_task with your session_id (or check_compliance, or run specreg comply for CLI/CI). If it is not compliant, remediate with targeted evidence only: add @spec[FILE#section] annotations only when the code entity is truly governed by that exact section, and never blanket-map files to PROJECT_PROFILE.md or broad requirements just to raise coverage. If no section governs the behavior, report missing_guidance or propose the needed spec. If repeated compliance attempts still fail, halt autonomous remediation and show the user the exact latest output. Do not report completion while objective compliance is failing or unavailable.';
    `,
  },
  {
    // Update already-seeded global operating specs in existing registries. This
    // only touches built-in seed-authored specs and is guarded against duplicates.
    version: 31,
    sql: `
      UPDATE specs
      SET content = replace(
            content,
            '16. If \`finish_task\`, \`check_compliance\`, or \`specreg comply\` cannot run because MCP or the SpecRegistry server appears unavailable, agents must halt before claiming completion, notify the user that objective compliance could not be verified, and include the exact tool or command output. Local specs and skills may guide work, but they are not a substitute for the registry completion gate.',
            '16. Before creating a git commit for implementation work, agents must include compact compliance evidence in the commit message body: the \`SpecRegistry-Compliance:\`, \`SpecRegistry-Signals:\`, and \`SpecRegistry-Command:\` trailer emitted by \`specreg comply\`, or equivalent \`finish_task\` evidence with verdict, objective score, and session id.
17. If \`finish_task\`, \`check_compliance\`, or \`specreg comply\` cannot run because MCP or the SpecRegistry server appears unavailable, agents must halt before claiming completion or committing, notify the user that objective compliance could not be verified, and include the exact tool or command output. Local specs and skills may guide work, but they are not a substitute for the registry completion gate.'
          ),
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE filename = 'AGENT_OPERATING_RULES.md'
        AND updated_by = 'seed'
        AND content LIKE '%16. If \`finish_task\`%'
        AND content NOT LIKE '%SpecRegistry-Compliance:%';

      UPDATE specs
      SET content = replace(
            content,
            '13. Before declaring a task complete, agents must call \`finish_task\` with their \`begin_task\` session id, or run \`specreg comply\` for CLI/CI workflows, and continue working until objective compliance passes. \`check_compliance\` remains available for direct compliance checks. A self-assessment of "done" is not sufficient; the registry''s objective coverage/drift gate decides. Agents must not claim completion while the check still reports outstanding items.',
            '13. Before declaring a task complete, agents must call \`finish_task\` with their \`begin_task\` session id, or run \`specreg comply\` for CLI/CI workflows, and continue working until objective compliance passes. \`check_compliance\` remains available for direct compliance checks. A self-assessment of "done" is not sufficient; the registry''s objective coverage/drift gate decides. Agents must not claim completion while the check still reports outstanding items.
14. Agents must remediate failed compliance with targeted evidence only. They may add \`@spec[FILE#section]\` annotations only when the code entity is truly governed by that exact section. They must not blanket-map files to \`PROJECT_PROFILE.md\`, broad requirements sections, or convenient specs just to raise coverage. If no exact governing section exists, report missing guidance or propose the needed spec.
15. If repeated \`finish_task\`, \`check_compliance\`, or \`specreg comply\` attempts still fail, agents must halt autonomous remediation, notify the user, and include the exact latest output instead of continuing speculative changes.
16. Before creating a git commit for implementation work, agents must include compact compliance evidence in the commit message body: the \`SpecRegistry-Compliance:\`, \`SpecRegistry-Signals:\`, and \`SpecRegistry-Command:\` trailer emitted by \`specreg comply\`, or equivalent \`finish_task\` evidence with verdict, objective score, and session id.
17. If \`finish_task\`, \`check_compliance\`, or \`specreg comply\` cannot run because MCP or the SpecRegistry server appears unavailable, agents must halt before claiming completion or committing, notify the user that objective compliance could not be verified, and include the exact tool or command output. Local specs and skills may guide work, but they are not a substitute for the registry completion gate.'
          ),
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE filename = 'AGENT_OPERATING_RULES.md'
        AND updated_by = 'seed'
        AND content LIKE '%13. Before declaring a task complete%'
        AND content NOT LIKE '%SpecRegistry-Compliance:%';

      UPDATE spec_versions
      SET content = replace(
            content,
            '13. Before declaring a task complete, agents must call \`finish_task\` with their \`begin_task\` session id, or run \`specreg comply\` for CLI/CI workflows, and continue working until objective compliance passes. \`check_compliance\` remains available for direct compliance checks. A self-assessment of "done" is not sufficient; the registry''s objective coverage/drift gate decides. Agents must not claim completion while the check still reports outstanding items.',
            '13. Before declaring a task complete, agents must call \`finish_task\` with their \`begin_task\` session id, or run \`specreg comply\` for CLI/CI workflows, and continue working until objective compliance passes. \`check_compliance\` remains available for direct compliance checks. A self-assessment of "done" is not sufficient; the registry''s objective coverage/drift gate decides. Agents must not claim completion while the check still reports outstanding items.
14. Agents must remediate failed compliance with targeted evidence only. They may add \`@spec[FILE#section]\` annotations only when the code entity is truly governed by that exact section. They must not blanket-map files to \`PROJECT_PROFILE.md\`, broad requirements sections, or convenient specs just to raise coverage. If no exact governing section exists, report missing guidance or propose the needed spec.
15. If repeated \`finish_task\`, \`check_compliance\`, or \`specreg comply\` attempts still fail, agents must halt autonomous remediation, notify the user, and include the exact latest output instead of continuing speculative changes.
16. Before creating a git commit for implementation work, agents must include compact compliance evidence in the commit message body: the \`SpecRegistry-Compliance:\`, \`SpecRegistry-Signals:\`, and \`SpecRegistry-Command:\` trailer emitted by \`specreg comply\`, or equivalent \`finish_task\` evidence with verdict, objective score, and session id.
17. If \`finish_task\`, \`check_compliance\`, or \`specreg comply\` cannot run because MCP or the SpecRegistry server appears unavailable, agents must halt before claiming completion or committing, notify the user that objective compliance could not be verified, and include the exact tool or command output. Local specs and skills may guide work, but they are not a substitute for the registry completion gate.'
          )
      WHERE spec_id IN (SELECT id FROM specs WHERE filename = 'AGENT_OPERATING_RULES.md' AND updated_by = 'seed')
        AND content LIKE '%13. Before declaring a task complete%'
        AND content NOT LIKE '%SpecRegistry-Compliance:%';

      UPDATE specs
      SET content = replace(
            content,
            '7. Reviewers must be able to trace acceptance evidence back to specific spec sections or explicit gaps.',
            '7. Reviewers must be able to trace acceptance evidence back to specific spec sections or explicit gaps.
8. Git commit messages for implementation work must include compact SpecRegistry compliance evidence: the \`SpecRegistry-Compliance:\`, \`SpecRegistry-Signals:\`, and \`SpecRegistry-Command:\` trailer emitted by \`specreg comply\`, or equivalent \`finish_task\` evidence with verdict, objective score, and session id.'
          ),
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE filename = 'IMPLEMENTATION_EVIDENCE.md'
        AND updated_by = 'seed'
        AND content LIKE '%7. Reviewers must be able to trace acceptance evidence%'
        AND content NOT LIKE '%SpecRegistry-Compliance:%';

      UPDATE spec_versions
      SET content = replace(
            content,
            '7. Reviewers must be able to trace acceptance evidence back to specific spec sections or explicit gaps.',
            '7. Reviewers must be able to trace acceptance evidence back to specific spec sections or explicit gaps.
8. Git commit messages for implementation work must include compact SpecRegistry compliance evidence: the \`SpecRegistry-Compliance:\`, \`SpecRegistry-Signals:\`, and \`SpecRegistry-Command:\` trailer emitted by \`specreg comply\`, or equivalent \`finish_task\` evidence with verdict, objective score, and session id.'
          )
      WHERE spec_id IN (SELECT id FROM specs WHERE filename = 'IMPLEMENTATION_EVIDENCE.md' AND updated_by = 'seed')
        AND content LIKE '%7. Reviewers must be able to trace acceptance evidence%'
        AND content NOT LIKE '%SpecRegistry-Compliance:%';
    `,
  },
  {
    // Repair any live database that advanced past the v21 widening migration but
    // still has agent_feedback.spec_id declared NOT NULL. Rebuilding is safe even
    // when the column is already nullable and preserves v25 gap metadata columns.
    version: 32,
    sql: `
      PRAGMA foreign_keys = OFF;
      ALTER TABLE agent_feedback RENAME TO agent_feedback_v32_old;
      CREATE TABLE agent_feedback (
        id TEXT PRIMARY KEY,
        spec_id TEXT REFERENCES specs(id),
        spec_version TEXT,
        agent_identifier TEXT NOT NULL,
        error_type TEXT NOT NULL CHECK (error_type IN ('ambiguity', 'contradiction', 'outdated', 'missing_guidance')),
        context_code_snippet TEXT,
        description TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved')),
        project_type_id TEXT REFERENCES project_types(id),
        languages TEXT,
        topic TEXT,
        created_at TEXT NOT NULL
      );
      INSERT INTO agent_feedback
        (id, spec_id, spec_version, agent_identifier, error_type, context_code_snippet, description, status,
         project_type_id, languages, topic, created_at)
        SELECT id, spec_id, spec_version, agent_identifier, error_type, context_code_snippet, description, status,
               project_type_id, languages, topic, created_at
        FROM agent_feedback_v32_old;
      DROP TABLE agent_feedback_v32_old;
      PRAGMA foreign_keys = ON;
    `,
  },
  {
    // Clarify the shipped baseline/project separation in existing registries.
    // This touches only seed-authored built-in specs and preserves admin-authored
    // project type/project content.
    version: 33,
    sql: `
      UPDATE specs
      SET content = replace(
            content,
            '8. Webhooks, sync jobs, and downstream PRs must carry enough summary context for consumers to verify the change.',
            '8. Webhooks, sync jobs, and downstream PRs must carry enough summary context for consumers to verify the change.
9. Project types must represent reusable baselines for a family of similar repositories, not one-off product instances.
10. Product-specific behavior, local deployment choices, repo-only API contracts, and implementation constraints must be captured as project-scoped specs attached to the concrete repository.
11. When a project-type spec starts to describe only one repository, reviewers should split the reusable baseline guidance from the project-specific guidance before publication.'
          ),
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE filename = 'SPEC_GOVERNANCE.md'
        AND updated_by = 'seed'
        AND content LIKE '%8. Webhooks, sync jobs%'
        AND content NOT LIKE '%Project types must represent reusable baselines%';

      UPDATE spec_versions
      SET content = replace(
            content,
            '8. Webhooks, sync jobs, and downstream PRs must carry enough summary context for consumers to verify the change.',
            '8. Webhooks, sync jobs, and downstream PRs must carry enough summary context for consumers to verify the change.
9. Project types must represent reusable baselines for a family of similar repositories, not one-off product instances.
10. Product-specific behavior, local deployment choices, repo-only API contracts, and implementation constraints must be captured as project-scoped specs attached to the concrete repository.
11. When a project-type spec starts to describe only one repository, reviewers should split the reusable baseline guidance from the project-specific guidance before publication.'
          )
      WHERE spec_id IN (SELECT id FROM specs WHERE filename = 'SPEC_GOVERNANCE.md' AND updated_by = 'seed')
        AND content LIKE '%8. Webhooks, sync jobs%'
        AND content NOT LIKE '%Project types must represent reusable baselines%';

      UPDATE specs
      SET content = replace(
            replace(
              replace(
                content,
                'A repository''s profile captures the local choices that make generic project-type guidance specific: product intent, stack, data stores, runtime, deployment, compliance posture, agent skills, and explicit non-goals.',
                'A repository''s profile captures the local choices that make generic project-type guidance specific: product intent, stack, data stores, runtime, deployment, compliance posture, agent skills, and explicit non-goals.
Project types are reusable baselines; projects are concrete repositories. The profile keeps a project from accidentally turning its baseline into a one-off project definition.'
              ),
              '6. Agents must not invent missing project profile choices; they must report ambiguity or ask for a reviewed profile change.',
              '6. Agents must not invent missing project profile choices; they must report ambiguity or ask for a reviewed profile change.
7. A project type should not be named after a single repository or product unless it is intentionally a reusable family name.
8. Specs that mention repo-specific routes, deployment hosts, credentials, local model catalogs, customers, research goals, or product behavior must be project-scoped unless at least one other project is expected to inherit the same rule.'
            ),
            '- Agent summaries respect published project-scoped profile constraints.',
            '- Agent summaries respect published project-scoped profile constraints.
- Dashboard project pages show inherited global/project-type specs separately from project-scoped specs.'
          ),
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE filename = 'PROJECT_PROFILE.md'
        AND updated_by = 'seed'
        AND content LIKE '%A repository''s profile captures%'
        AND content NOT LIKE '%projects are concrete repositories%';

      UPDATE spec_versions
      SET content = replace(
            replace(
              replace(
                content,
                'A repository''s profile captures the local choices that make generic project-type guidance specific: product intent, stack, data stores, runtime, deployment, compliance posture, agent skills, and explicit non-goals.',
                'A repository''s profile captures the local choices that make generic project-type guidance specific: product intent, stack, data stores, runtime, deployment, compliance posture, agent skills, and explicit non-goals.
Project types are reusable baselines; projects are concrete repositories. The profile keeps a project from accidentally turning its baseline into a one-off project definition.'
              ),
              '6. Agents must not invent missing project profile choices; they must report ambiguity or ask for a reviewed profile change.',
              '6. Agents must not invent missing project profile choices; they must report ambiguity or ask for a reviewed profile change.
7. A project type should not be named after a single repository or product unless it is intentionally a reusable family name.
8. Specs that mention repo-specific routes, deployment hosts, credentials, local model catalogs, customers, research goals, or product behavior must be project-scoped unless at least one other project is expected to inherit the same rule.'
            ),
            '- Agent summaries respect published project-scoped profile constraints.',
            '- Agent summaries respect published project-scoped profile constraints.
- Dashboard project pages show inherited global/project-type specs separately from project-scoped specs.'
          )
      WHERE spec_id IN (SELECT id FROM specs WHERE filename = 'PROJECT_PROFILE.md' AND updated_by = 'seed')
        AND content LIKE '%A repository''s profile captures%'
        AND content NOT LIKE '%projects are concrete repositories%';
    `,
  },
  {
    // Track projected context tokens by spec section and real LLM usage reports.
    version: 34,
    sql: `
      CREATE TABLE IF NOT EXISTS context_events (
        id TEXT PRIMARY KEY,
        project_type_id TEXT REFERENCES project_types(id),
        consumer_id TEXT REFERENCES repo_consumers(id),
        repo TEXT,
        agent_session_id TEXT REFERENCES agent_sessions(id),
        event_type TEXT NOT NULL,
        source TEXT,
        detail TEXT,
        actor TEXT,
        estimated_tokens INTEGER NOT NULL DEFAULT 0,
        section_count INTEGER NOT NULL DEFAULT 0,
        tokenizer TEXT NOT NULL DEFAULT 'chars/4:v1',
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_context_events_project ON context_events(consumer_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_context_events_type ON context_events(project_type_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_context_events_session ON context_events(agent_session_id, created_at);

      CREATE TABLE IF NOT EXISTS context_event_sections (
        id TEXT PRIMARY KEY,
        context_event_id TEXT NOT NULL REFERENCES context_events(id) ON DELETE CASCADE,
        spec_id TEXT NOT NULL REFERENCES specs(id),
        spec_version TEXT,
        filename TEXT NOT NULL,
        section_title TEXT NOT NULL,
        section_anchor TEXT NOT NULL,
        chars INTEGER NOT NULL DEFAULT 0,
        estimated_tokens INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_context_event_sections_event ON context_event_sections(context_event_id);
      CREATE INDEX IF NOT EXISTS idx_context_event_sections_spec ON context_event_sections(spec_id, section_anchor);

      CREATE TABLE IF NOT EXISTS llm_usage_reports (
        id TEXT PRIMARY KEY,
        project_type_id TEXT REFERENCES project_types(id),
        consumer_id TEXT REFERENCES repo_consumers(id),
        repo TEXT,
        agent_session_id TEXT REFERENCES agent_sessions(id),
        provider TEXT,
        model TEXT,
        route TEXT,
        prompt_tokens INTEGER NOT NULL DEFAULT 0,
        completion_tokens INTEGER NOT NULL DEFAULT 0,
        total_tokens INTEGER NOT NULL DEFAULT 0,
        cached_tokens INTEGER NOT NULL DEFAULT 0,
        input_cost_usd REAL,
        output_cost_usd REAL,
        total_cost_usd REAL,
        latency_ms INTEGER,
        related_context_event_ids TEXT NOT NULL DEFAULT '[]',
        detail TEXT,
        actor TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_llm_usage_project ON llm_usage_reports(consumer_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_llm_usage_type ON llm_usage_reports(project_type_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_llm_usage_session ON llm_usage_reports(agent_session_id, created_at);
    `,
  },
  {
    // Marketplace foundation: external sources and untrusted imported candidates.
    version: 35,
    sql: `
      CREATE TABLE IF NOT EXISTS skill_sources (
        id TEXT PRIMARY KEY,
        url TEXT NOT NULL UNIQUE,
        provider TEXT NOT NULL DEFAULT 'github',
        source_type TEXT NOT NULL DEFAULT 'github_repo' CHECK (source_type IN ('github_repo', 'github_search', 'local_upload', 'builtin_pack', 'manual')),
        license TEXT,
        default_branch TEXT,
        last_fetched_commit TEXT,
        last_scan_at TEXT,
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
        trust_decision TEXT NOT NULL DEFAULT 'unreviewed' CHECK (trust_decision IN ('trusted', 'unreviewed', 'blocked')),
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_skill_sources_status ON skill_sources(status, trust_decision);

      CREATE TABLE IF NOT EXISTS skill_candidates (
        id TEXT PRIMARY KEY,
        source_id TEXT REFERENCES skill_sources(id) ON DELETE SET NULL,
        source_url TEXT,
        source_path TEXT,
        source_commit TEXT,
        detected_format TEXT NOT NULL DEFAULT 'unknown',
        raw_content_hash TEXT NOT NULL,
        raw_content TEXT NOT NULL,
        license TEXT,
        category TEXT,
        candidate_type TEXT NOT NULL DEFAULT 'unknown' CHECK (candidate_type IN ('agent_skill', 'spec_seed', 'project_type_template', 'reference_only', 'unsafe', 'unknown')),
        proposed_name TEXT NOT NULL,
        proposed_slug TEXT NOT NULL,
        risk_level TEXT NOT NULL DEFAULT 'safe' CHECK (risk_level IN ('safe', 'restricted')),
        risk_summary TEXT NOT NULL DEFAULT '',
        detected_commands TEXT NOT NULL DEFAULT '[]',
        detected_network TEXT NOT NULL DEFAULT '[]',
        detected_secrets TEXT NOT NULL DEFAULT '[]',
        gate_status TEXT NOT NULL DEFAULT 'pending' CHECK (gate_status IN ('pass', 'review', 'block', 'pending')),
        gate_results TEXT NOT NULL DEFAULT '[]',
        classifier_notes TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'candidate' CHECK (status IN ('candidate', 'converted', 'rejected', 'archived')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_skill_candidates_source ON skill_candidates(source_id, status);
      CREATE INDEX IF NOT EXISTS idx_skill_candidates_type ON skill_candidates(candidate_type, status);
    `,
  },
  {
    // Persist deterministic candidate security/quality gate outcomes.
    version: 36,
    sql: `
      ALTER TABLE skill_candidates ADD COLUMN gate_status TEXT NOT NULL DEFAULT 'pending' CHECK (gate_status IN ('pass', 'review', 'block', 'pending'));
      ALTER TABLE skill_candidates ADD COLUMN gate_results TEXT NOT NULL DEFAULT '[]';
    `,
  },
  {
    // Track provenance for governed skills converted from marketplace candidates.
    version: 37,
    sql: `
      ALTER TABLE agent_skills ADD COLUMN source_candidate_id TEXT REFERENCES skill_candidates(id);
      ALTER TABLE agent_skills ADD COLUMN source_url TEXT;
      ALTER TABLE agent_skills ADD COLUMN source_path TEXT;
      ALTER TABLE agent_skills ADD COLUMN source_commit TEXT;
      ALTER TABLE agent_skills ADD COLUMN imported_at TEXT;
      ALTER TABLE agent_skills ADD COLUMN transformed_by TEXT;
      ALTER TABLE agent_skills ADD COLUMN transformation_note TEXT;
      ALTER TABLE agent_skills ADD COLUMN upstream_content_hash TEXT;
    `,
  },
  {
    // Review-gated skill changes before active governed procedure updates.
    version: 38,
    sql: `
      CREATE TABLE IF NOT EXISTS skill_change_requests (
        id TEXT PRIMARY KEY,
        skill_id TEXT NOT NULL REFERENCES agent_skills(id) ON DELETE CASCADE,
        action TEXT NOT NULL CHECK (action IN ('update', 'enable', 'disable', 'delete')),
        current_name TEXT NOT NULL,
        current_description TEXT NOT NULL,
        current_instructions TEXT NOT NULL,
        current_risk_level TEXT NOT NULL,
        current_status TEXT NOT NULL,
        proposed_name TEXT NOT NULL,
        proposed_description TEXT NOT NULL,
        proposed_instructions TEXT NOT NULL,
        proposed_risk_level TEXT NOT NULL,
        proposed_status TEXT NOT NULL,
        summary TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
        proposed_by TEXT NOT NULL,
        reviewed_by TEXT,
        reviewed_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_skill_change_requests_status ON skill_change_requests(status, created_at);
      CREATE INDEX IF NOT EXISTS idx_skill_change_requests_skill ON skill_change_requests(skill_id, created_at);
    `,
  },
  {
    // Scoped skill assignments for agent packs and project/project-type selection.
    version: 39,
    sql: `
      CREATE TABLE IF NOT EXISTS skill_assignments (
        id TEXT PRIMARY KEY,
        skill_id TEXT NOT NULL REFERENCES agent_skills(id) ON DELETE CASCADE,
        scope TEXT NOT NULL CHECK (scope IN ('global', 'project_type', 'project')),
        project_type_id TEXT REFERENCES project_types(id),
        project_id TEXT REFERENCES repo_consumers(id),
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE(skill_id, scope, project_type_id, project_id)
      );
      CREATE INDEX IF NOT EXISTS idx_skill_assignments_scope ON skill_assignments(scope, project_type_id, project_id);
    `,
  },
  {
    // Links between governed skills and the specifications/sections they use or implement.
    version: 40,
    sql: `
      CREATE TABLE IF NOT EXISTS skill_spec_links (
        id TEXT PRIMARY KEY,
        skill_id TEXT NOT NULL REFERENCES agent_skills(id) ON DELETE CASCADE,
        spec_id TEXT NOT NULL REFERENCES specs(id) ON DELETE CASCADE,
        section_anchor TEXT,
        relation TEXT NOT NULL DEFAULT 'related' CHECK (relation IN ('related', 'governs', 'recommends', 'supports')),
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE(skill_id, spec_id, section_anchor, relation)
      );
      CREATE INDEX IF NOT EXISTS idx_skill_spec_links_skill ON skill_spec_links(skill_id);
      CREATE INDEX IF NOT EXISTS idx_skill_spec_links_spec ON skill_spec_links(spec_id);
    `,
  },
  {
    // Immutable skill versions for local skill currency checks and locked agent packs.
    version: 41,
    sql: `
      CREATE TABLE IF NOT EXISTS agent_skill_versions (
        id TEXT PRIMARY KEY,
        skill_id TEXT NOT NULL REFERENCES agent_skills(id) ON DELETE CASCADE,
        version TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        instructions TEXT NOT NULL,
        risk_level TEXT NOT NULL CHECK (risk_level IN ('safe', 'restricted')),
        status TEXT NOT NULL CHECK (status IN ('active', 'disabled')),
        published_by TEXT NOT NULL,
        changelog TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        UNIQUE(skill_id, version),
        UNIQUE(skill_id, content_hash)
      );
      CREATE INDEX IF NOT EXISTS idx_agent_skill_versions_skill ON agent_skill_versions(skill_id, created_at);
    `,
  },
  {
    // Persist deterministic governance audit reports as reviewable evidence artifacts.
    version: 42,
    sql: `
      CREATE TABLE IF NOT EXISTS audit_reports (
        id TEXT PRIMARY KEY,
        report_type TEXT NOT NULL CHECK (report_type IN ('project_governance', 'spec_quality', 'agent_run', 'release', 'registry_operations')),
        subject_type TEXT NOT NULL CHECK (subject_type IN ('project', 'spec', 'agent_session', 'release', 'registry')),
        subject_id TEXT,
        subject_label TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('pass', 'warning', 'fail', 'unknown')),
        summary TEXT NOT NULL,
        evidence_json TEXT NOT NULL,
        markdown TEXT NOT NULL,
        llm_summary TEXT,
        generated_by TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_audit_reports_subject ON audit_reports(subject_type, subject_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_audit_reports_type_time ON audit_reports(report_type, created_at);
    `,
  },
  {
    // Carry file paths on trace links so release/PR audits can map changed files to governing specs.
    version: 43,
    sql: `
      ALTER TABLE code_trace_links ADD COLUMN entity_path TEXT;
    `,
  },
];

const DEFAULT_AGENT_SKILLS = [
  {
    slug: "register-task-session",
    name: "Register the task session",
    description: "Open a governed agent session with begin_task before doing non-trivial implementation work.",
    instructions: "Before non-trivial work, call begin_task with the concrete task, a short plan, the model in use, and the spec files you intend to load. Resolve any returned blockers before editing, follow the declared plan, and keep the returned session_id to pass to finish_task when the work is complete.",
  },
  {
    slug: "load-governed-specs",
    name: "Load governed specs",
    description: "Load the current global, project-type, and project-scoped specifications before implementation work.",
    instructions: "Before non-trivial work, call begin_task to register the session, then use the SpecRegistry MCP get_specs tool for the configured project type and repository to load the governed bundle. Check the local manifest for drift. Treat published specs as authoritative and do not treat drafts as approved guidance.",
  },
  {
    slug: "resolve-uncovered-guidance",
    name: "Resolve uncovered guidance",
    description: "Pull governed guidance before writing in a language or domain the loaded specs do not cover.",
    instructions: "Before writing in a language, or working in a domain (networking, authentication, database, deployment) the loaded specs do not clearly cover, call resolve_guidance. Pull the styleguides and specs it returns. If it reports a coverage gap, call report_spec_feedback with error_type missing_guidance plus the relevant languages/topic instead of inventing a standard.",
  },
  {
    slug: "search-spec-context",
    name: "Search spec context",
    description: "Find focused governing sections without injecting the entire spec set into context.",
    instructions: "Use search_specs in hybrid mode with concrete task terms, filenames, APIs, security concerns, and acceptance criteria. Cite the returned spec and section. Load full documents only when the focused sections are insufficient.",
  },
  {
    slug: "report-spec-problems",
    name: "Report spec problems",
    description: "Report ambiguity, contradiction, or outdated guidance instead of guessing around it.",
    instructions: "When guidance is ambiguous, contradictory, incomplete, or outdated, stop the affected decision and call report_spec_feedback. Include the spec, section, task, conflicting evidence, and the decision that needs clarification.",
  },
  {
    slug: "plan-from-specs",
    name: "Plan from specs",
    description: "Turn governed requirements into an implementation plan and acceptance evidence.",
    instructions: "Identify applicable specs and acceptance criteria before editing. Produce a concise plan that maps each implementation step and verification step to governing requirements. Call out missing coverage rather than inventing requirements.",
  },
  {
    slug: "verify-conformance",
    name: "Verify conformance",
    description: "Check implementation results against the current governed specification set.",
    instructions: "After implementation, run relevant tests and a reverse conformance check. Compare behavior, configuration, interfaces, and operational evidence with the current specs. Report violations and intent mismatches separately.",
  },
  {
    slug: "collect-delivery-evidence",
    name: "Collect delivery evidence",
    description: "Record the tests, checks, and operational evidence that support a completed change.",
    instructions: "Summarize commands run, test outcomes, affected specs, known residual risks, and any unverified requirement. Before creating a git commit for implementation work, include compact compliance evidence in the commit message body: the SpecRegistry-Compliance, SpecRegistry-Signals, and SpecRegistry-Command trailer emitted by specreg comply, or equivalent finish_task evidence with verdict, objective score, and session id. Do not claim a check passed unless it was actually executed and its result observed.",
  },
  {
    slug: "run-compliance-loop",
    name: "Run the compliance loop",
    description: "Confirm objective compliance before claiming a task is complete, and keep working until it passes.",
    instructions: "Before declaring a task done, call finish_task with your session_id (or check_compliance, or run specreg comply for CLI/CI). If it is not compliant, remediate with targeted evidence only: add @spec[FILE#section] annotations only when the code entity is truly governed by that exact section, and never blanket-map files to PROJECT_PROFILE.md or broad requirements just to raise coverage. If no section governs the behavior, report missing_guidance or propose the needed spec. If repeated compliance attempts still fail, halt autonomous remediation and show the user the exact latest output. Before creating a git commit for implementation work, include the compact SpecRegistry-Compliance/SpecRegistry-Signals/SpecRegistry-Command trailer emitted by specreg comply, or equivalent finish_task evidence. Do not report completion while objective compliance is failing or unavailable.",
  },
  {
    slug: "propose-not-publish",
    name: "Propose, do not self-approve",
    description: "Propose changes to governed specs through review; never approve or publish your own change.",
    instructions: "You may create, edit, and publish project-scoped specs for your own enrolled repo, but only propose changes to global and project-type specs through the review workflow. Never approve or publish a change you proposed — approval is a separate human action. Authenticate only as your own enrolled agent identity and stay within the documented MCP tools and the specreg CLI.",
  },
  {
    slug: "evaluate-quality-model",
    name: "Evaluate the quality model",
    description: "Run the external QUALITY.md evaluation loop against this project's governed quality rubric, if one exists.",
    instructions: "If this project has a published QUALITY.md spec (a portable quality rubric of areas, factors, requirements, and a rating scale — see https://getquality.md/specification), load it with get_specs or search_specs before making quality judgments. Its YAML frontmatter is a valid, spec-compliant QUALITY.md document: use the external `qualitymd` CLI or `/quality` agent skill to actually run the evaluation and generate a report — SpecRegistry governs the rubric's content, versioning, and review history, it does not implement the evaluation methodology itself. Report ambiguous, stale, or unassessable requirements with report_spec_feedback, and propose rubric changes through the normal review workflow; never hand-edit a published QUALITY.md directly. If no QUALITY.md exists yet, treat that as a spec gap rather than inventing an ad hoc quality bar — consider generating one with `specreg generate` (purpose: quality-model).",
  },
] as const;

const DEFAULT_SKILL_SOURCES = [
  {
    id: "starter-github-agent-skills-search",
    url: "https://github.com/search?q=agent+skills&type=repositories",
    provider: "github",
    source_type: "github_search",
    notes: "Curated starter search for public repositories advertising agent skills. Search results must be imported as untrusted candidates before review.",
  },
  {
    id: "starter-agency-agents",
    url: "https://github.com/msitarzewski/agency-agents",
    provider: "github",
    source_type: "github_repo",
    notes: "Starter source suggested by users for reusable agency/agent role material. Treat imported material as candidates until reviewed.",
  },
  {
    id: "starter-anthropics-skills",
    url: "https://github.com/anthropics/skills",
    provider: "github",
    source_type: "github_repo",
    notes: "Starter source for Anthropic-style skill packages. Verify license and upstream structure before conversion.",
  },
  {
    id: "starter-addyosmani-agent-skills",
    url: "https://github.com/addyosmani/agent-skills",
    provider: "github",
    source_type: "github_repo",
    notes: "Starter source for agent skill examples and patterns. Imported material remains untrusted until review.",
  },
  {
    id: "starter-vercel-labs-skills",
    url: "https://github.com/vercel-labs/skills",
    provider: "github",
    source_type: "github_repo",
    notes: "Starter source for framework-oriented skill examples. Review for project specificity before conversion.",
  },
  {
    id: "starter-google-skills",
    url: "https://github.com/google/skills",
    provider: "github",
    source_type: "github_repo",
    notes: "Starter source for possible Google-authored skill examples. Confirm repository existence, license, and current contents before import.",
  },
  {
    id: "starter-agentskills",
    url: "https://github.com/agentskills/agentskills",
    provider: "github",
    source_type: "github_repo",
    notes: "Starter source for the agentskills catalog. Import only through candidate review.",
  },
  {
    id: "starter-mattpocock-skills",
    url: "https://github.com/mattpocock/skills",
    provider: "github",
    source_type: "github_repo",
    notes: "Starter source for Matt Pocock's TypeScript-focused skills. Imported material remains untrusted until review; verify license and project fit before conversion.",
  },
] as const;

function seedDefaultAgentSkills(db: Db): void {
  const insert = db.prepare(
    `INSERT OR IGNORE INTO agent_skills
      (id, slug, name, description, instructions, risk_level, status, built_in, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'safe', 'active', 1, ?, ?)`
  );
  const ts = now();
  for (const skill of DEFAULT_AGENT_SKILLS) {
    insert.run(`builtin-${skill.slug}`, skill.slug, skill.name, skill.description, skill.instructions, ts, ts);
  }
}

function seedDefaultSkillSources(db: Db): void {
  const insert = db.prepare(
    `INSERT OR IGNORE INTO skill_sources
      (id, url, provider, source_type, status, trust_decision, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'active', 'unreviewed', ?, ?, ?)`
  );
  const ts = now();
  for (const source of DEFAULT_SKILL_SOURCES) {
    insert.run(source.id, source.url, source.provider, source.source_type, source.notes, ts, ts);
  }
}

function seedDefaultSkillAssignments(db: Db): void {
  const skills = db
    .prepare("SELECT id FROM agent_skills WHERE built_in = 1 AND risk_level = 'safe'")
    .all() as Array<{ id: string }>;
  const insert = db.prepare(
    `INSERT OR IGNORE INTO skill_assignments
      (id, skill_id, scope, project_type_id, project_id, created_by, created_at)
     VALUES (?, ?, 'global', NULL, NULL, 'seed', ?)`
  );
  const ts = now();
  for (const skill of skills) {
    insert.run(`global-${skill.id}`, skill.id, ts);
  }
}

interface SkillVersionSeedRow {
  id: string;
  slug: string;
  name: string;
  description: string;
  instructions: string;
  risk_level: string;
  status: string;
  source_candidate_id?: string | null;
  source_url?: string | null;
  source_path?: string | null;
  source_commit?: string | null;
  upstream_content_hash?: string | null;
}

function renderSkillMarkdownForHash(skill: SkillVersionSeedRow): string {
  return `---
name: ${skill.slug}
description: ${JSON.stringify(skill.description.replace(/\s+/g, " ").trim())}
metadata:
  specregistry_id: ${skill.id}
  risk_level: ${skill.risk_level}
  source_candidate_id: ${skill.source_candidate_id ?? ""}
  source_url: ${skill.source_url ?? ""}
  source_path: ${skill.source_path ?? ""}
  source_commit: ${skill.source_commit ?? ""}
  upstream_content_hash: ${skill.upstream_content_hash ?? ""}
---

# ${skill.name}

${skill.description}

## Instructions

${skill.instructions.trim()}

## Safety Boundary

This skill is a governed operating procedure, not permission to take external or destructive
actions. Follow the agent host's approval policy, current published specifications, and the
principle of least privilege. Stop and ask when required authorization or intent is unclear.
`;
}

function seedDefaultSkillVersions(db: Db): void {
  const skills = db
    .prepare(
      `SELECT ask.*
       FROM agent_skills ask
       LEFT JOIN agent_skill_versions asv ON asv.skill_id = ask.id
       WHERE asv.id IS NULL`
    )
    .all() as SkillVersionSeedRow[];
  const insert = db.prepare(
    `INSERT OR IGNORE INTO agent_skill_versions
      (id, skill_id, version, content_hash, name, description, instructions, risk_level, status, published_by, changelog, created_at)
     VALUES (?, ?, '1.0.0', ?, ?, ?, ?, ?, ?, 'seed', 'Initial governed skill version.', ?)`
  );
  const ts = now();
  for (const skill of skills) {
    const hash = crypto.createHash("sha256").update(renderSkillMarkdownForHash(skill)).digest("hex");
    insert.run(`version-${skill.id}-1-0-0`, skill.id, hash, skill.name, skill.description, skill.instructions, skill.risk_level, skill.status, ts);
  }
}

export function createDb(path: string): Db {
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  const hasSpecs = Boolean(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'specs'").get());
  if (hasSpecs) {
    const specsColumns = db.prepare("PRAGMA table_info(specs)").all() as Array<{ name: string }>;
    if (!specsColumns.some((column) => column.name === "project_id")) {
      db.exec("ALTER TABLE specs ADD COLUMN project_id TEXT REFERENCES repo_consumers(id)");
    }
  }
  const hasChangeRequests = Boolean(
    db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'change_requests'").get()
  );
  if (hasChangeRequests) {
    const changeColumns = db.prepare("PRAGMA table_info(change_requests)").all() as Array<{ name: string }>;
    if (!changeColumns.some((column) => column.name === "risk")) {
      db.exec("ALTER TABLE change_requests ADD COLUMN risk TEXT");
    }
  }
  const hasSettings = Boolean(
    db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'settings'").get()
  );
  db.exec(SCHEMA);
  const row = db.prepare("SELECT value FROM settings WHERE key = 'schema_version'").get() as
    | { value: string }
    | undefined;
  let version = row ? Number(row.value) : hasSettings ? 0 : MIGRATIONS[MIGRATIONS.length - 1]?.version ?? 0;
  for (const migration of MIGRATIONS) {
    if (migration.version <= version) continue;
    try {
      db.exec(migration.sql);
    } catch {
      // already satisfied by the fresh-schema definition (e.g. column exists)
    }
    version = migration.version;
  }
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('schema_version', ?)").run(String(version));
  seedDefaultAgentSkills(db);
  seedDefaultSkillVersions(db);
  seedDefaultSkillSources(db);
  seedDefaultSkillAssignments(db);
  return db;
}

export function now(): string {
  return new Date().toISOString();
}

export function uuid(): string {
  return crypto.randomUUID();
}
