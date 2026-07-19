import type {
  AgentFeedback,
  ChangeRequest,
  ProjectType,
  RepoSubscription,
  Spec,
  SpecSummary,
  SpecTemplate,
  SpecVersion,
  SyncJob,
  Webhook,
} from "@specregistry/shared";

export type ProjectTypeWithCount = ProjectType & {
  spec_count: number;
  project_spec_count?: number;
  project_count?: number;
  project_type_smell?: number;
};
export interface EfficacyRun {
  id: string;
  spec_id: string;
  task_prompt: string;
  score_with: number;
  score_without: number;
  improved: number;
  rationale: string;
  model: string;
  created_at: string;
}
export type SpecDetail = Spec & {
  versions: Array<SpecVersion & { channel?: string }>;
  change_requests: ChangeRequest[];
  feedback: AgentFeedback[];
  efficacy_runs: EfficacyRun[];
};
export interface SpecAssistResponse {
  spec_id: string;
  filename: string;
  mode: "example" | "rewrite";
  guidance: string;
  content: string;
  model: string;
  provider: string;
}
export interface NewSpecAssistResponse {
  project_type_id: string;
  project_type: string;
  filename: string;
  mode: "example" | "rewrite";
  guidance: string;
  content: string;
  model: string;
  provider: string;
}
export type ReviewRow = ChangeRequest & {
  filename: string;
  current_version: string;
  project_type_id: string;
  project_type_name: string;
};
export type ReviewDetail = ChangeRequest & {
  spec: Spec;
  approvals: Array<{ reviewer: string; created_at: string }>;
  approval_count: number;
  required_approvals: number;
  approval_policy: null | {
    id: string;
    filename_glob: string;
    min_approvals: number;
    required_reviewers: string[];
  };
};
export interface PublishPreview {
  change_request_id: string;
  filename: string;
  sync_jobs_to_enqueue: number;
  affected_repositories: Array<{ repo: string; branch: string; base_path: string }>;
  generated_agent_files: string[];
  webhooks_to_fire: Array<{ id: string; format: string; events: string }>;
  impact?: {
    scope: "global" | "project_type" | "project";
    level: "low" | "medium" | "high" | "critical";
    score: number;
    summary: string;
    affected_project_types: Array<{ id: string; name: string; scope: string }>;
    manifest_consumers: Array<{ id: string; repo: string; branch: string | null; commit_sha: string | null; manifest_path: string; last_seen_at: string }>;
    repo_subscriptions: Array<{ repo: string; branch: string; base_path: string }>;
    dependent_specs: Array<{ spec_id: string; filename: string; relation: string }>;
    feedback: { total: number; open: number };
    pending_reviews: number;
    recent_usage: Record<string, number>;
  };
  migration_checklist?: MigrationChecklist;
  pr_summary_markdown?: string;
  checks: Record<string, unknown>;
}
export interface MigrationChecklist {
  spec_id: string;
  filename: string;
  version_delta: string;
  impact_level: string;
  affected_projects: number;
  affected_subscriptions: number;
  dependent_specs: Array<{ spec_id: string; filename: string; relation: string }>;
  items: string[];
}
export interface SpecImpactResponse {
  spec: Spec;
  impact: NonNullable<PublishPreview["impact"]>;
  migration_checklist: MigrationChecklist;
  pr_summary_markdown: string;
}
export interface ManifestDiagnostics {
  project_type: string;
  project_type_id: string;
  project_id: string | null;
  project: string | null;
  up_to_date: string[];
  outdated: Array<{ filename: string; local_version: string; latest_version: string; severity: string; within_pin: boolean }>;
  missing_locally: Array<{ filename: string; latest_version: string }>;
  not_on_server: string[];
  drift: boolean;
  local_count: number;
  latest_count: number;
  latest_specs: Array<{ filename: string; latest_version: string; scope: string; project_type: string }>;
  local_only_count: number;
  breaking_count: number;
}
export interface ReviewSlaSummary {
  warn_hours: number;
  breach_hours: number;
  pending_count: number;
  warning_count: number;
  breached_count: number;
  oldest_age_hours: number;
  queue: Array<
    Pick<ReviewRow, "id" | "spec_id" | "filename" | "project_type_name" | "proposed_by" | "version_delta" | "summary" | "created_at"> & {
      current_version: string;
      approval_count: number;
      required_approvals: number;
      remaining_approvals: number;
      age_hours: number;
      sla_status: "ok" | "warning" | "breached";
    }
  >;
}
export type FeedbackRow = AgentFeedback & {
  filename: string | null;
  current_version: string | null;
  project_type_name: string | null;
};
export type SubscriptionRow = RepoSubscription & { project_type_name: string };
export type SyncJobRow = SyncJob & { repo: string; branch: string; filename: string };
export interface RepoConsumerRow {
  id: string;
  repo: string;
  branch: string | null;
  commit_sha: string | null;
  project_type_id: string;
  project_type_name: string;
  specs_path: string;
  manifest_path: string;
  source: string;
  first_seen_at: string;
  last_seen_at: string;
  spec_count: number;
  outdated_count: number;
}
export interface ProjectRow extends RepoConsumerRow {
  project_spec_count: number;
  open_feedback_count: number;
  code_trace_reported_at: string | null;
}
export interface AnalyticsSummary {
  window_days: number;
  events: Record<string, number>;
  top_project_types: Array<{ name: string; n: number }>;
  stale_specs: Array<{
    id: string;
    filename: string;
    current_version: string;
    updated_at: string;
    project_type_name: string;
  }>;
}
export interface ReportsOverview {
  generated_at: string;
  window_days: number;
  scopes: Array<{ scope: "global" | "project_type" | "project"; status: string; n: number }>;
  feedback_by_type: Array<{ error_type: string; status: string; n: number }>;
  project_types: Array<{
    id: string;
    name: string;
    scope: string;
    industry: string | null;
    spec_count: number;
    published_specs: number;
    project_spec_count: number;
    project_count: number;
    open_feedback: number;
    feedback_total: number;
    pending_reviews: number;
    stale_specs: number;
    efficacy_runs: number;
    efficacy_improved: number;
    usage: Record<string, number>;
  }>;
  projects: Array<{
    id: string;
    repo: string;
    branch: string | null;
    project_type_id: string;
    project_type_name: string;
    specs_path: string;
    manifest_path: string;
    last_seen_at: string;
    reported_specs: number;
    project_specs: number;
    open_feedback: number;
    feedback_total: number;
    pending_reviews: number;
    outdated_specs: number;
    code_trace_report_id: string | null;
    code_coverage_ratio: number | null;
    code_drift_score: number | null;
    code_drift_severity: "none" | "low" | "medium" | "high" | null;
    code_linked_entity_count: number | null;
    code_governed_entity_count: number | null;
    code_unlinked_entity_count: number | null;
    code_trace_reported_at: string | null;
  }>;
  code_trace_reports: Array<{
    id: string;
    consumer_id: string;
    repo: string;
    branch: string | null;
    project_type_name: string;
    generated_at: string;
    specs_dir: string;
    spec_count: number;
    entity_count: number;
    governed_entity_count: number;
    linked_entity_count: number;
    unlinked_entity_count: number;
    coverage_ratio: number;
    drift_score: number;
    drift_severity: "none" | "low" | "medium" | "high";
    aliases_count: number;
    unlinked_sample: string;
    created_at: string;
    link_count: number;
  }>;
  global_specs: Array<{
    id: string;
    filename: string;
    current_version: string;
    status: string;
    updated_at: string;
    open_feedback: number;
    feedback_total: number;
    pending_reviews: number;
    efficacy_runs: number;
    efficacy_improved: number;
  }>;
}
export interface TokenUsageReport {
  generated_at: string;
  window_days: number;
  project_id: string | null;
  tokenizer: string;
  projects: Array<{
    project_id: string;
    repo: string;
    project_type_name: string;
    context_events: number;
    projected_tokens: number;
    delivered_sections: number;
    real_prompt_tokens: number;
    real_completion_tokens: number;
    real_total_tokens: number;
    total_cost_usd: number;
    last_reported_at: string | null;
  }>;
  by_spec: Array<{
    spec_id: string;
    filename: string;
    spec_version: string | null;
    context_events: number;
    delivered_sections: number;
    chars: number;
    projected_tokens: number;
    last_delivered_at: string | null;
  }>;
  by_section: Array<{
    spec_id: string;
    filename: string;
    spec_version: string | null;
    section_title: string;
    section_anchor: string;
    context_events: number;
    deliveries: number;
    chars: number;
    projected_tokens: number;
    last_delivered_at: string | null;
  }>;
  by_event_type: Array<{
    event_type: string;
    context_events: number;
    delivered_sections: number;
    projected_tokens: number;
    last_delivered_at: string | null;
  }>;
  sessions: Array<{
    agent_session_id: string;
    task: string;
    repo: string | null;
    context_events: number;
    delivered_sections: number;
    projected_tokens: number;
    last_delivered_at: string | null;
  }>;
  real_usage: Array<{
    provider: string | null;
    model: string | null;
    route: string | null;
    reports: number;
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    cached_tokens: number;
    total_cost_usd: number;
    last_reported_at: string | null;
  }>;
  trend: Array<{
    day: string;
    projected_tokens: number;
    delivered_sections: number;
    context_events: number;
    real_prompt_tokens: number;
    real_completion_tokens: number;
    real_total_tokens: number;
    reports: number;
    total_cost_usd: number;
  }>;
}
export type TokenUsageFilters = {
  project_id?: string;
  days?: number;
  event_type?: string;
  agent_session_id?: string;
  provider?: string;
  model?: string;
  spec_id?: string;
  section?: string;
};
export type AuditReportStatus = "pass" | "warning" | "fail" | "unknown";
export type AuditReportType = "project_governance" | "spec_quality" | "agent_run" | "release" | "registry_operations";
export type AuditReportSubjectType = "project" | "spec" | "agent_session" | "release" | "registry";
export interface AuditReportSummaryRow {
  id: string;
  report_type: AuditReportType;
  subject_type: AuditReportSubjectType;
  subject_id: string | null;
  subject_label: string;
  status: AuditReportStatus;
  summary: string;
  generated_by: string;
  created_at: string;
}
export interface AuditReportDetail extends AuditReportSummaryRow {
  evidence_json: string;
  markdown: string;
  llm_summary: string | null;
  evidence: unknown;
}
export interface DependencyMap {
  specs: Array<{ id: string; filename: string; project_type_name: string; project_name?: string | null }>;
  edges: Array<{ from_spec_id: string; from_filename: string; to_spec_id: string | null; to_filename: string; relation: string }>;
  unresolved: Array<{ from_filename: string; to_filename: string; relation: string }>;
}
export interface SpecPurposeTemplate {
  id: string;
  filename: string;
  title: string;
  description: string;
  required_sections: string[];
  prompt: string;
  content_template: string;
  signals: string[];
}
export interface SpecGap {
  purpose_id: string;
  filename: string;
  title: string;
  reason: string;
  confidence: number;
  evidence: string[];
}
export interface GenerationPreview {
  project_type: string;
  purpose: SpecPurposeTemplate;
  filename: string;
  prompt: string;
  content: string;
  model: string | null;
  provider: string | null;
}
export interface TaskPlan {
  task: string;
  applicable_specs: Array<{ spec_id: string; filename: string; reason: string; priority: number }>;
  sections: Array<{ spec_id: string; filename: string; section: string; classification: string; reason: string; approx_tokens: number }>;
  missing_specs: SpecGap[];
  acceptance_criteria: string[];
  context_selection: {
    token_budget: number;
    estimated_tokens: number;
    selected_sections: Array<{ filename: string; section: string; classification: string; approx_tokens: number }>;
    omitted_sections: Array<{ filename: string; section: string; classification: string; approx_tokens: number }>;
  };
  llm_notes?: string;
  model?: string;
  provider?: string;
}
export type AutomationFlags = Record<
  | "enabled"
  | "gap_detection"
  | "generation"
  | "quality_models"
  | "llm_generation"
  | "task_planner"
  | "ticket_generator"
  | "maintenance"
  | "pack_composer"
  | "audit_prompts"
  | "section_classifier"
  | "context_optimizer",
  boolean
>;
export type CodeMetadataFlags = Record<
  | "enabled"
  | "typescript_javascript"
  | "python"
  | "sql"
  | "route_detection"
  | "schema_detection"
  | "stable_ids"
  | "sidecar_metadata"
  | "inline_metadata"
  | "traceability_graph"
  | "semantic_drift"
  | "code_embedding_profile"
  | "coverage_reports",
  boolean
>;
export type HarnessImprovementFlags = Record<
  "enabled" | "failure_pattern_mining" | "proposal_drafting" | "regression_validation" | "review_promotion",
  boolean
>;
export interface FeatureDescriptor {
  key: string;
  label: string;
  description: string;
  stage: "available" | "planned";
}
export interface FeatureConfig {
  automation: AutomationFlags;
  code_metadata: CodeMetadataFlags;
  harness_improvement: HarnessImprovementFlags;
  catalog: {
    automation: FeatureDescriptor[];
    code_metadata: FeatureDescriptor[];
    harness_improvement: FeatureDescriptor[];
  };
}
export interface HarnessImprovementInsight {
  key: string;
  title: string;
  category: string;
  severity: "low" | "medium" | "high";
  support: number;
  evidence: string[];
  proposed_surface: string;
  suggested_action: string;
  validation_gate: string;
}
export interface HarnessImprovementInsights {
  enabled: boolean;
  generated_at: string;
  summary: { patterns: number; evidence_items: number };
  patterns: HarnessImprovementInsight[];
}
export interface HarnessImprovementProposal {
  key: string;
  title: string;
  rationale: string;
  proposal_type: "agent_skill_update";
  target_skill: {
    id: string;
    slug: string;
    name: string;
    risk_level: string;
    status: string;
    built_in: boolean;
  };
  current_instructions: string;
  proposed_instructions: string;
  proposed_addition: string;
  validation_gate: string;
  validation: HarnessProposalValidation["validation"];
  promotion: string;
}
export interface HarnessProposalRow {
  id: string;
  pattern_key: string;
  title: string;
  rationale: string;
  target_type: "agent_skill";
  target_id: string;
  target_slug: string;
  current_instructions: string;
  proposed_instructions: string;
  proposed_addition: string;
  validation_gate: string;
  status: "pending" | "approved" | "rejected";
  proposed_by: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  target_name?: string;
  target_risk_level?: string;
  target_status?: string;
}
export interface HarnessProposalValidation {
  proposal_id: string;
  target_slug: string;
  current_target_matches_proposal: boolean;
  validation: {
    status: "passed" | "failed";
    gate: string;
    checks: Array<{ key: string; passed: boolean; detail: string }>;
  };
}
export interface SearchHit {
  spec_id: string;
  filename: string;
  project_type_name: string;
  current_version: string;
  section: string;
  section_anchor: string;
  permalink: string;
  excerpt: string;
  score?: number;
  match_type?: "fts" | "semantic" | "hybrid";
  explanation?: string;
}
export interface UserRow {
  id: string;
  username: string;
  display_name: string | null;
  role: "admin" | "reviewer" | "author" | "agent";
  source: "local" | "ldap";
  created_at: string;
}
export interface ApiKeyRow {
  id: string;
  user_id: string;
  username: string;
  role: string;
  name: string | null;
  created_at: string;
  last_used_at: string | null;
}
export interface LdapConfig {
  enabled: boolean;
  url: string;
  bind_dn_template: string;
  bind_user: string;
  search_base: string;
  search_filter: string;
  admin_group: string;
  reviewer_group: string;
  default_role: "admin" | "reviewer" | "author" | "agent";
  has_bind_password: boolean;
}
export type LlmProvider = "anthropic" | "openai" | "gemini" | "openai_compatible" | "openrouter" | "bitdeer" | "together" | "vultr" | "nvidia";
export interface LlmProviderDescriptor {
  id: LlmProvider;
  label: string;
  family: "native" | "openai_compatible";
  description: string;
  default_base_url: string;
  default_model: string;
  model: string;
  base_url: string;
  model_fallbacks: string[];
  requires_api_key: boolean;
  has_api_key: boolean;
  docs_url?: string;
}
export interface LlmConfig {
  provider: LlmProvider;
  model: string;
  base_url: string;
  max_tokens: number;
  has_api_key: boolean;
}
export type LlmTier = "cheap" | "standard" | "frontier";
export type LlmTaskRoute =
  | "classification"
  | "summarization"
  | "spec_generation"
  | "task_planning"
  | "ticket_generation"
  | "audit"
  | "draft_fix"
  | "efficacy"
  | "maintenance"
  | "test";
export interface LlmTierConfig extends LlmConfig {
  tier: LlmTier;
  label: string;
  description: string;
}
export interface LlmTieringConfig {
  tiers: Record<LlmTier, LlmTierConfig>;
  routes: Record<LlmTaskRoute, LlmTier>;
}
export interface EmbeddingConfig {
  provider: "local_hash" | "openai" | "gemini" | "openai_compatible";
  model: string;
  base_url: string;
  dimensions: number;
  has_api_key: boolean;
}
export interface EmbeddingStatus {
  provider: string;
  model: string;
  dimensions: number;
  indexed_sections: number;
  published_sections: number;
  last_indexed_at: string | null;
  ready: boolean;
}
export interface AppKeyConfig {
  has_github_token: boolean;
  has_github_webhook_secret: boolean;
  has_slack_signing_secret: boolean;
}
export interface PublicUrlConfig {
  public_hostname: string;
  detected_ip: string;
  effective_public_url: string;
  source: "env" | "setting" | "forwarded" | "detected_ip";
}
export interface McpGuide {
  filename: string;
  project_type: string | null;
  mcp_config: Record<string, unknown>;
  content: string;
}
export interface ApprovalPolicyRow {
  id: string;
  project_type_id: string | null;
  project_type_name?: string | null;
  filename_glob: string;
  min_approvals: number;
  required_reviewers: string;
  created_at: string;
  updated_at: string;
}
export interface FeedbackCluster {
  key: string;
  spec_id: string | null;
  filename: string | null;
  project_type_name: string | null;
  error_type: string;
  count: number;
  status_counts: Record<string, number>;
  latest_at: string;
  sample_description: string;
  feedback_ids: string[];
}
export interface VersionStatus {
  package_version: string;
  is_git_checkout: boolean;
  git_sha: string | null;
  git_sha_short: string | null;
  git_branch: string | null;
  is_dirty: boolean | null;
  repo_slug: string | null;
  github: {
    repo: string | null;
    checked: boolean;
    status: "up_to_date" | "behind" | "ahead" | "diverged" | "unknown";
    behind_by: number | null;
    ahead_by: number | null;
    latest_sha: string | null;
    error: string | null;
    checked_at: string | null;
  };
  self_update_enabled: boolean;
}
export interface UpdateResult {
  ok: boolean;
  message: string;
  previous_sha: string | null;
  new_sha: string | null;
  updated: boolean;
  dependencies_installed: boolean;
  build_ran: boolean;
  output: string;
}
export interface AuditLogRow {
  id: string;
  actor: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  summary: string;
  detail: string | null;
  created_at: string;
}
export interface AgentSkillRow {
  id: string;
  slug: string;
  name: string;
  description: string;
  instructions: string;
  risk_level: "safe" | "restricted";
  status: "active" | "disabled";
  built_in: number;
  source_candidate_id: string | null;
  source_url: string | null;
  source_path: string | null;
  source_commit: string | null;
  imported_at: string | null;
  transformed_by: string | null;
  transformation_note: string | null;
  upstream_content_hash: string | null;
  created_at: string;
  updated_at: string;
}
export interface SkillSourceRow {
  id: string;
  url: string;
  provider: string;
  source_type: "github_repo" | "github_search" | "local_upload" | "builtin_pack" | "manual";
  license: string | null;
  default_branch: string | null;
  last_fetched_commit: string | null;
  last_scan_at: string | null;
  status: "active" | "paused" | "archived";
  trust_decision: "trusted" | "unreviewed" | "blocked";
  notes: string | null;
  created_at: string;
  updated_at: string;
}
export interface SkillCandidateRow {
  id: string;
  source_id: string | null;
  source_url: string | null;
  source_path: string | null;
  source_commit: string | null;
  detected_format: string;
  raw_content_hash: string;
  raw_content: string;
  license: string | null;
  category: string | null;
  candidate_type: "agent_skill" | "spec_seed" | "project_type_template" | "reference_only" | "unsafe" | "unknown";
  proposed_name: string;
  proposed_slug: string;
  risk_level: "safe" | "restricted";
  risk_summary: string;
  detected_commands: string;
  detected_network: string;
  detected_secrets: string;
  gate_status: "pass" | "review" | "block" | "pending";
  gate_results: string;
  classifier_notes: string;
  status: "candidate" | "converted" | "rejected" | "archived";
  created_at: string;
  updated_at: string;
}
export interface SkillReviewRow {
  id: string;
  skill_id: string;
  skill_slug: string;
  skill_built_in: number;
  action: "update" | "enable" | "disable" | "delete";
  current_name: string;
  current_description: string;
  current_instructions: string;
  current_risk_level: AgentSkillRow["risk_level"];
  current_status: AgentSkillRow["status"];
  proposed_name: string;
  proposed_description: string;
  proposed_instructions: string;
  proposed_risk_level: AgentSkillRow["risk_level"];
  proposed_status: AgentSkillRow["status"];
  summary: string;
  status: "pending" | "approved" | "rejected";
  proposed_by: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}
export interface SkillAssignmentRow {
  id: string;
  skill_id: string;
  scope: "global" | "project_type" | "project";
  project_type_id: string | null;
  project_id: string | null;
  created_by: string;
  created_at: string;
  skill_slug: string;
  skill_name: string;
  risk_level: AgentSkillRow["risk_level"];
  skill_status: AgentSkillRow["status"];
  project_type_name: string | null;
  project_repo: string | null;
}
export interface SkillSpecLinkRow {
  id: string;
  skill_id: string;
  spec_id: string;
  section_anchor: string | null;
  relation: "related" | "governs" | "recommends" | "supports";
  created_by: string;
  created_at: string;
  skill_slug: string;
  skill_name: string;
  filename: string;
  current_version: string;
  project_type_name: string;
}
export interface SkillSourceScanResult {
  source_id: string;
  scanned: number;
  created: number;
  skipped: number;
  candidates: Array<{
    id: string;
    source_path: string;
    proposed_name: string;
    candidate_type: SkillCandidateRow["candidate_type"];
    gate_status: SkillCandidateRow["gate_status"];
    created: boolean;
  }>;
}
export interface ComplianceAttestationRow {
  id: string;
  project_type_id: string | null;
  consumer_id: string | null;
  repo: string | null;
  project_type_name: string | null;
  self_assessed_score: number | null;
  objective_score: number;
  compliant: number;
  coverage_ratio: number | null;
  drift_score: number | null;
  outstanding: string;
  iteration: number;
  created_at: string;
}
export interface CompliancePolicy {
  min_coverage: number;
  max_drift: number;
  required_mapped_kinds: string[];
}
export interface CompliancePolicyRow {
  id: string;
  project_type_id: string | null;
  project_type_name: string | null;
  min_coverage: number;
  max_drift: number;
  required_mapped_kinds: string;
  created_at: string;
  updated_at: string;
}
export interface CompliancePolicyConfig {
  default: CompliancePolicy;
  policies: CompliancePolicyRow[];
}

const TOKEN_KEY = "specregistry.token";
const USERNAME_KEY = "specregistry.username";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getLoginUsername(): string | null {
  return localStorage.getItem(USERNAME_KEY);
}

export function setSession(token: string, username: string): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USERNAME_KEY, username);
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USERNAME_KEY);
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      message = body.message ?? body.error ?? message;
    } catch {
      // keep default message
    }
    throw new Error(message);
  }
  return (await res.json()) as T;
}

async function requestVoid(url: string, init?: RequestInit): Promise<void> {
  const token = getToken();
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      message = body.message ?? body.error ?? message;
    } catch {
      // keep default message
    }
    throw new Error(message);
  }
}

export const api = {
  projectTypes: () => request<ProjectTypeWithCount[]>("/api/v1/project-types"),
  createProjectType: (body: { name: string; industry?: string; description?: string }) =>
    request<ProjectType>("/api/v1/project-types", { method: "POST", body: JSON.stringify(body) }),
  projects: () => request<ProjectRow[]>("/api/v1/projects"),
  project: (id: string) => request<ProjectRow>(`/api/v1/projects/${encodeURIComponent(id)}`),
  createProject: (body: { repo: string; project_type_id: string; branch?: string; specs_path?: string; manifest_path?: string }) =>
    request<ProjectRow>("/api/v1/projects", { method: "POST", body: JSON.stringify(body) }),

  specs: (params?: { project_type_id?: string; project_id?: string }) => {
    const qs = new URLSearchParams();
    if (params?.project_type_id) qs.set("project_type_id", params.project_type_id);
    if (params?.project_id) qs.set("project_id", params.project_id);
    return request<SpecSummary[]>(`/api/v1/specs${qs.size ? `?${qs.toString()}` : ""}`);
  },
  spec: (id: string) => request<SpecDetail>(`/api/v1/specs/${id}`),
  specImpact: (id: string, delta = "minor") => request<SpecImpactResponse>(`/api/v1/specs/${id}/impact?delta=${encodeURIComponent(delta)}`),
  specAssist: (id: string, body: { mode: "example" | "rewrite"; guidance: string; current_content?: string }) =>
    request<SpecAssistResponse>(`/api/v1/specs/${id}/assist`, { method: "POST", body: JSON.stringify(body) }),
  newSpecAssist: (body: { project_type_id: string; project_id?: string; filename: string; guidance: string; current_content?: string }) =>
    request<NewSpecAssistResponse>("/api/v1/specs/assist-draft", { method: "POST", body: JSON.stringify(body) }),
  createSpec: (body: { project_type_id: string; project_id?: string; filename: string; content: string; updated_by: string }) =>
    request<Spec>("/api/v1/specs", { method: "POST", body: JSON.stringify(body) }),
  deleteSpec: (id: string) =>
    requestVoid(`/api/v1/specs/${encodeURIComponent(id)}`, { method: "DELETE", body: JSON.stringify({ confirm: true }) }),
  restoreSpec: (id: string) =>
    request<Spec>(`/api/v1/specs/${encodeURIComponent(id)}/restore`, { method: "POST" }),
  deletedSpecs: () =>
    request<Array<SpecSummary & { deleted_at: string }>>("/api/v1/specs/deleted"),
  purgeSpecs: () =>
    request<{ purged: number; filenames: string[] }>("/api/v1/specs/purge", { method: "POST" }),
  updateDraft: (id: string, body: { content: string; updated_by: string }) =>
    request<Spec>(`/api/v1/specs/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  publishDraft: (id: string, published_by: string) =>
    request<Spec>(`/api/v1/specs/${id}/publish`, { method: "POST", body: JSON.stringify({ published_by }) }),
  submitReview: (body: {
    spec_id: string;
    proposed_content: string;
    version_delta: string;
    proposed_by: string;
    summary?: string;
  }) => request<ChangeRequest>("/api/v1/specs/review", { method: "POST", body: JSON.stringify(body) }),

  reviews: (status?: string) =>
    request<ReviewRow[]>(`/api/v1/reviews${status ? `?status=${status}` : ""}`),
  reviewSla: () => request<ReviewSlaSummary>("/api/v1/reviews/sla"),
  review: (id: string) => request<ReviewDetail>(`/api/v1/reviews/${id}`),
  publishPreview: (id: string) => request<PublishPreview>(`/api/v1/reviews/${id}/publish-preview`),
  approveReview: (id: string, reviewed_by: string, channel?: "stable" | "beta") =>
    request<ChangeRequest>(`/api/v1/reviews/${id}/approve`, {
      method: "POST",
      body: JSON.stringify({ reviewed_by, ...(channel === "beta" ? { channel } : {}) }),
    }),
  rejectReview: (id: string, reviewed_by: string) =>
    request<ChangeRequest>(`/api/v1/reviews/${id}/reject`, { method: "POST", body: JSON.stringify({ reviewed_by }) }),

  feedback: (status?: string) =>
    request<FeedbackRow[]>(`/api/v1/ai/feedback${status ? `?status=${status}` : ""}`),
  feedbackClusters: (status?: string) =>
    request<FeedbackCluster[]>(`/api/v1/ai/feedback/clusters${status ? `?status=${status}` : ""}`),
  setFeedbackClusterStatus: (key: string, status: string) =>
    request<{ key: string; status: string; updated: number }>("/api/v1/ai/feedback/clusters/status", {
      method: "POST",
      body: JSON.stringify({ key, status }),
    }),
  draftClusterFix: (key: string) =>
    request<ChangeRequest>("/api/v1/ai/feedback/clusters/draft-fix", { method: "POST", body: JSON.stringify({ key }) }),
  createFeedback: (body: {
    spec_id: string;
    spec_version?: string;
    agent_identifier: string;
    error_type: "ambiguity" | "contradiction" | "outdated";
    description: string;
    context_code_snippet?: string;
  }) => request<AgentFeedback>("/api/v1/ai/feedback", { method: "POST", body: JSON.stringify(body) }),
  setFeedbackStatus: (id: string, status: string) =>
    request<AgentFeedback>(`/api/v1/ai/feedback/${id}/status`, { method: "POST", body: JSON.stringify({ status }) }),
  draftFix: (feedbackId: string) =>
    request<ChangeRequest>(`/api/v1/ai/feedback/${feedbackId}/draft-fix`, { method: "POST", body: JSON.stringify({}) }),

  search: (q: string, projectType?: string, mode: "fts" | "semantic" | "hybrid" = "fts") =>
    request<{ query: string; mode: string; results: SearchHit[] }>(
      `/api/v1/ai/search?q=${encodeURIComponent(q)}&mode=${encodeURIComponent(mode)}${projectType ? `&project_type=${encodeURIComponent(projectType)}` : ""}`
    ),

  templates: () => request<SpecTemplate[]>("/api/v1/templates"),
  createTemplate: (body: {
    filename: string;
    required_sections: string[];
    content_template?: string;
    description?: string;
  }) => request<SpecTemplate>("/api/v1/templates", { method: "POST", body: JSON.stringify(body) }),
  updateTemplate: (id: string, body: Partial<{ required_sections: string[]; content_template: string; description: string }>) =>
    request<SpecTemplate>(`/api/v1/templates/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteTemplate: (id: string) => requestVoid(`/api/v1/templates/${id}`, { method: "DELETE" }),

  webhooks: () => request<Webhook[]>("/api/v1/webhooks"),
  createWebhook: (body: { url: string; events: string[]; format: string }) =>
    request<Webhook>("/api/v1/webhooks", { method: "POST", body: JSON.stringify(body) }),
  deleteWebhook: (id: string) => requestVoid(`/api/v1/webhooks/${id}`, { method: "DELETE" }),

  subscriptions: () => request<SubscriptionRow[]>("/api/v1/subscriptions"),
  repoConsumers: () => request<RepoConsumerRow[]>("/api/v1/cli/consumers"),
  createSubscription: (body: { project_type_id: string; repo: string; branch?: string; base_path?: string }) =>
    request<RepoSubscription>("/api/v1/subscriptions", { method: "POST", body: JSON.stringify(body) }),
  deleteSubscription: (id: string) => requestVoid(`/api/v1/subscriptions/${id}`, { method: "DELETE" }),
  syncJobs: () => request<SyncJobRow[]>("/api/v1/sync-jobs"),
  runSyncJobs: () =>
    request<{ processed: number }>("/api/v1/sync-jobs/run", { method: "POST", body: JSON.stringify({}) }),

  analytics: () => request<AnalyticsSummary>("/api/v1/analytics/summary"),
  reports: () => request<ReportsOverview>("/api/v1/reports/overview"),
  auditReports: (filters: { report_type?: string; subject_type?: string; subject_id?: string } = {}) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value) params.set(key, value);
    }
    return request<AuditReportSummaryRow[]>(`/api/v1/audit-reports${params.size ? `?${params.toString()}` : ""}`);
  },
  auditReport: (id: string) => request<AuditReportDetail>(`/api/v1/audit-reports/${encodeURIComponent(id)}`),
  createProjectAuditReport: (project: string) =>
    request<AuditReportDetail>("/api/v1/audit-reports/project", { method: "POST", body: JSON.stringify({ project }) }),
  tokenUsageReport: (filters: TokenUsageFilters = {}) => {
    const params = new URLSearchParams();
    params.set("days", String(filters.days ?? 30));
    for (const [key, value] of Object.entries(filters)) {
      if (key === "days" || value == null || value === "") continue;
      params.set(key, String(value));
    }
    return request<TokenUsageReport>(`/api/v1/reports/token-usage?${params.toString()}`);
  },
  manifestDiagnostics: (body: { manifest?: unknown; project_type?: string; repo?: string; project_id?: string }) =>
    request<ManifestDiagnostics>("/api/v1/cli/manifest-diagnostics", { method: "POST", body: JSON.stringify(body) }),
  dependencyMap: () => request<DependencyMap>("/api/v1/specs/dependency-map"),
  tokenRoi: () => request<{ specs: Array<{ filename: string; approx_tokens: number; roi_score: number; open_feedback: number }> }>(
    "/api/v1/ai/token-roi"
  ),
  auditLog: (limit = 100) => request<AuditLogRow[]>(`/api/v1/audit-log?limit=${limit}`),
  complianceAttestations: (repo?: string) =>
    request<ComplianceAttestationRow[]>(
      `/api/v1/compliance-attestations${repo ? `?repo=${encodeURIComponent(repo)}` : ""}`
    ),
  compliancePolicies: () => request<CompliancePolicyConfig>("/api/v1/compliance-policies"),
  updateCompliancePolicy: (body: { project_type?: string; min_coverage: number; max_drift: number; required_mapped_kinds: string[] }) =>
    request<CompliancePolicy>("/api/v1/compliance-policies", { method: "PUT", body: JSON.stringify(body) }),

  login: (username: string, password: string) =>
    request<{ token: string; user: { username: string; role: string } }>("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  me: () => request<{ id: string; username: string; role: string }>("/api/v1/auth/me"),
  version: () => request<VersionStatus>("/api/v1/meta/version"),
  triggerUpdate: () => request<UpdateResult>("/api/v1/admin/update", { method: "POST" }),
  users: () => request<UserRow[]>("/api/v1/auth/users"),
  createUser: (body: { username: string; role: string; password?: string; display_name?: string }) =>
    request<UserRow>("/api/v1/auth/users", { method: "POST", body: JSON.stringify(body) }),
  changePassword: (userId: string, body: { current_password?: string; new_password: string }) =>
    request<{ success: boolean }>(`/api/v1/auth/users/${encodeURIComponent(userId)}/password`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  apiKeys: () => request<ApiKeyRow[]>("/api/v1/auth/api-keys"),
  createApiKey: (body: { username: string; name?: string }) =>
    request<{ token: string; username: string; role: string }>("/api/v1/auth/api-keys", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  deleteApiKey: (id: string) => requestVoid(`/api/v1/auth/api-keys/${id}`, { method: "DELETE" }),
  ldapConfig: () => request<LdapConfig>("/api/v1/ldap/config"),
  updateLdapConfig: (body: Partial<Omit<LdapConfig, "enabled" | "has_bind_password">> & {
    bind_password?: string;
    clear_bind_password?: boolean;
  }) => request<LdapConfig>("/api/v1/ldap/config", { method: "PUT", body: JSON.stringify(body) }),
  testLdap: (username: string, password: string) =>
    request<{ ok: boolean; username: string; dn: string; display_name: string | null; groups: string[]; role: string }>(
      "/api/v1/ldap/test",
      { method: "POST", body: JSON.stringify({ username, password }) }
    ),
  previewLdapRole: (groups: string[]) =>
    request<{ role: string; groups: string[] }>("/api/v1/ldap/role-preview", {
      method: "POST",
      body: JSON.stringify({ groups }),
    }),
  llmConfig: () => request<LlmConfig>("/api/v1/llm/config"),
  llmProviders: () => request<{ providers: LlmProviderDescriptor[] }>("/api/v1/llm/providers"),
  updateLlmProvider: (provider: LlmProvider, body: Partial<Pick<LlmConfig, "model" | "base_url">> & { api_key?: string; clear_api_key?: boolean }) =>
    request<LlmProviderDescriptor>(`/api/v1/llm/providers/${provider}`, { method: "PUT", body: JSON.stringify(body) }),
  llmProviderModels: (provider: LlmProvider) => request<{ provider: LlmProvider; models: string[] }>(`/api/v1/llm/providers/${provider}/models`),
  testLlmProvider: (provider: LlmProvider, prompt?: string, max_tokens?: number) =>
    request<{ ok: boolean; provider: string; model: string; text: string; max_tokens: number }>(`/api/v1/llm/providers/${provider}/test`, {
      method: "POST",
      body: JSON.stringify({ prompt, max_tokens }),
    }),
  updateLlmConfig: (body: Partial<Omit<LlmConfig, "has_api_key">> & { api_key?: string; clear_api_key?: boolean }) =>
    request<LlmConfig>("/api/v1/llm/config", { method: "PUT", body: JSON.stringify(body) }),
  testLlm: (prompt?: string, max_tokens?: number, tier?: LlmTier, route?: LlmTaskRoute) =>
    request<{ ok: boolean; provider: string; model: string; tier: LlmTier; route: LlmTaskRoute; text: string; max_tokens: number }>("/api/v1/llm/test", {
      method: "POST",
      body: JSON.stringify({ prompt, max_tokens, tier, route }),
    }),
  llmModels: () => request<{ provider: string; models: string[] }>("/api/v1/llm/models"),
  llmTiering: () => request<LlmTieringConfig>("/api/v1/llm/tiering"),
  updateLlmTier: (tier: LlmTier, body: Partial<Omit<LlmConfig, "has_api_key">> & { api_key?: string; clear_api_key?: boolean }) =>
    request<LlmTierConfig>(`/api/v1/llm/tiering/tier/${tier}`, { method: "PUT", body: JSON.stringify(body) }),
  updateLlmRoutes: (routes: Partial<Record<LlmTaskRoute, LlmTier>>) =>
    request<{ routes: Record<LlmTaskRoute, LlmTier> }>("/api/v1/llm/tiering/routes", { method: "PUT", body: JSON.stringify({ routes }) }),
  llmTierModels: (tier: LlmTier) => request<{ provider: string; models: string[]; tier: LlmTier }>(`/api/v1/llm/models/${tier}`),
  embeddingConfig: () => request<EmbeddingConfig>("/api/v1/embeddings/config"),
  updateEmbeddingConfig: (body: Partial<Omit<EmbeddingConfig, "has_api_key">> & { api_key?: string; clear_api_key?: boolean }) =>
    request<EmbeddingConfig>("/api/v1/embeddings/config", { method: "PUT", body: JSON.stringify(body) }),
  embeddingStatus: () => request<EmbeddingStatus>("/api/v1/embeddings/status"),
  reindexEmbeddings: () =>
    request<{ indexed_sections: number; provider: string; model: string; status: EmbeddingStatus }>("/api/v1/embeddings/reindex", {
      method: "POST",
      body: JSON.stringify({}),
    }),
  appKeys: () => request<AppKeyConfig>("/api/v1/app-keys"),
  updateAppKeys: (
    body: Partial<{
      github_token: string;
      github_webhook_secret: string;
      slack_signing_secret: string;
      clear_github_token: boolean;
      clear_github_webhook_secret: boolean;
      clear_slack_signing_secret: boolean;
    }>
  ) => request<AppKeyConfig>("/api/v1/app-keys", { method: "PUT", body: JSON.stringify(body) }),
  publicUrlConfig: () => request<PublicUrlConfig>("/api/v1/server/public-url"),
  updatePublicUrlConfig: (body: { public_hostname: string }) =>
    request<PublicUrlConfig>("/api/v1/server/public-url", { method: "PUT", body: JSON.stringify(body) }),
  mcpGuide: (projectType?: string) =>
    request<McpGuide>(`/api/v1/ai/mcp-guide${projectType ? `/${encodeURIComponent(projectType)}` : ""}`),
  agentSkills: (includeDisabled = false) =>
    request<AgentSkillRow[]>(`/api/v1/skills${includeDisabled ? "?include_disabled=true" : ""}`),
  createAgentSkill: (body: Pick<AgentSkillRow, "name" | "slug" | "description" | "instructions" | "risk_level">) =>
    request<AgentSkillRow>("/api/v1/skills", { method: "POST", body: JSON.stringify(body) }),
  updateAgentSkill: (id: string, body: Partial<Pick<AgentSkillRow, "name" | "description" | "instructions" | "risk_level" | "status">>) =>
    request<AgentSkillRow>(`/api/v1/skills/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteAgentSkill: (id: string) => requestVoid(`/api/v1/skills/${id}`, { method: "DELETE" }),
  skillAssignments: () => request<SkillAssignmentRow[]>("/api/v1/skills/assignments"),
  createSkillAssignment: (body: { skill_id: string; scope: SkillAssignmentRow["scope"]; project_type_id?: string; project_id?: string }) =>
    request<SkillAssignmentRow>("/api/v1/skills/assignments", { method: "POST", body: JSON.stringify(body) }),
  deleteSkillAssignment: (id: string) => requestVoid(`/api/v1/skills/assignments/${id}`, { method: "DELETE" }),
  skillSpecLinks: (skillId?: string) =>
    request<SkillSpecLinkRow[]>(`/api/v1/skills/spec-links${skillId ? `?skill_id=${encodeURIComponent(skillId)}` : ""}`),
  createSkillSpecLink: (body: { skill_id: string; spec_id: string; section_anchor?: string; relation?: SkillSpecLinkRow["relation"] }) =>
    request<SkillSpecLinkRow>("/api/v1/skills/spec-links", { method: "POST", body: JSON.stringify(body) }),
  deleteSkillSpecLink: (id: string) => requestVoid(`/api/v1/skills/spec-links/${id}`, { method: "DELETE" }),
  skillSources: () => request<SkillSourceRow[]>("/api/v1/skills/sources"),
  createSkillSource: (body: Partial<SkillSourceRow> & { url: string }) =>
    request<SkillSourceRow>("/api/v1/skills/sources", { method: "POST", body: JSON.stringify(body) }),
  updateSkillSource: (id: string, body: Partial<SkillSourceRow>) =>
    request<SkillSourceRow>(`/api/v1/skills/sources/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  scanSkillSource: (id: string) =>
    request<SkillSourceScanResult>(`/api/v1/skills/sources/${id}/scan`, { method: "POST", body: JSON.stringify({}) }),
  skillCandidates: (filters: { source_id?: string; status?: string } = {}) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
    const query = params.toString();
    return request<SkillCandidateRow[]>(`/api/v1/skills/candidates${query ? `?${query}` : ""}`);
  },
  createSkillCandidate: (body: {
    source_id?: string;
    source_url?: string;
    source_path?: string;
    source_commit?: string;
    detected_format?: string;
    raw_content: string;
    license?: string;
    category?: string;
    candidate_type?: SkillCandidateRow["candidate_type"];
    proposed_name: string;
    proposed_slug?: string;
    risk_level?: AgentSkillRow["risk_level"];
    risk_summary?: string;
    classifier_notes?: string;
    status?: SkillCandidateRow["status"];
  }) => request<SkillCandidateRow>("/api/v1/skills/candidates", { method: "POST", body: JSON.stringify(body) }),
  classifySkillCandidate: (id: string) =>
    request<SkillCandidateRow>(`/api/v1/skills/candidates/${id}/classify`, { method: "POST", body: JSON.stringify({}) }),
  runSkillCandidateGates: (id: string) =>
    request<SkillCandidateRow>(`/api/v1/skills/candidates/${id}/gates`, { method: "POST", body: JSON.stringify({}) }),
  convertSkillCandidate: (id: string, body: Partial<Pick<AgentSkillRow, "name" | "slug" | "description" | "instructions" | "risk_level">> & { transformation_note?: string } = {}) =>
    request<AgentSkillRow>(`/api/v1/skills/candidates/${id}/convert-skill`, { method: "POST", body: JSON.stringify(body) }),
  skillReviews: (status?: SkillReviewRow["status"]) =>
    request<SkillReviewRow[]>(`/api/v1/skills/reviews${status ? `?status=${encodeURIComponent(status)}` : ""}`),
  createSkillReview: (skillId: string, body: Partial<Pick<AgentSkillRow, "name" | "description" | "instructions" | "risk_level" | "status">> & { action: SkillReviewRow["action"]; summary?: string }) =>
    request<SkillReviewRow>(`/api/v1/skills/${skillId}/reviews`, { method: "POST", body: JSON.stringify(body) }),
  approveSkillReview: (id: string, reviewed_by: string) =>
    request<SkillReviewRow>(`/api/v1/skills/reviews/${id}/approve`, { method: "POST", body: JSON.stringify({ reviewed_by }) }),
  rejectSkillReview: (id: string, reviewed_by: string) =>
    request<SkillReviewRow>(`/api/v1/skills/reviews/${id}/reject`, { method: "POST", body: JSON.stringify({ reviewed_by }) }),
  approvalPolicies: () => request<ApprovalPolicyRow[]>("/api/v1/approval-policies"),
  createApprovalPolicy: (body: {
    project_type_id?: string | null;
    filename_glob: string;
    min_approvals: number;
    required_reviewers: string[];
  }) => request<ApprovalPolicyRow>("/api/v1/approval-policies", { method: "POST", body: JSON.stringify(body) }),
  deleteApprovalPolicy: (id: string) => requestVoid(`/api/v1/approval-policies/${id}`, { method: "DELETE" }),
  promote: (specId: string, version: string, promoted_by: string) =>
    request<Spec>(`/api/v1/specs/${specId}/promote`, {
      method: "POST",
      body: JSON.stringify({ version, promoted_by }),
    }),
  runEfficacy: (spec_id: string, task_prompt: string) =>
    request<EfficacyRun>("/api/v1/ai/efficacy", { method: "POST", body: JSON.stringify({ spec_id, task_prompt }) }),
  efficacyTrends: () => request<{ runs: Array<EfficacyRun & { filename: string }> }>("/api/v1/ai/efficacy/trends"),
  runAudit: (body: { project_type: string; tree: string; files: Array<{ path: string; content: string }> }) =>
    request<{ project_type: string; findings: unknown[]; finding_count: number }>("/api/v1/ai/audit", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateProjectType: (id: string, body: Record<string, unknown>) =>
    request<ProjectType>(`/api/v1/project-types/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  specPurposes: () => request<SpecPurposeTemplate[]>("/api/v1/spec-purposes"),
  automationFeatures: () => request<AutomationFlags>("/api/v1/automation/features"),
  featureConfig: () => request<FeatureConfig>("/api/v1/features/config"),
  updateFeatureConfig: (body: Partial<Pick<FeatureConfig, "automation" | "code_metadata" | "harness_improvement">>) =>
    request<FeatureConfig>("/api/v1/features/config", { method: "PUT", body: JSON.stringify(body) }),
  harnessImprovementInsights: () => request<HarnessImprovementInsights>("/api/v1/features/harness-insights"),
  harnessImprovementProposal: (key: string) =>
    request<HarnessImprovementProposal>(`/api/v1/features/harness-insights/${encodeURIComponent(key)}/proposal`, {
      method: "POST",
      body: JSON.stringify({}),
    }),
  createHarnessProposal: (key: string, proposed_by: string) =>
    request<HarnessProposalRow>(`/api/v1/features/harness-insights/${encodeURIComponent(key)}/proposals`, {
      method: "POST",
      body: JSON.stringify({ proposed_by }),
    }),
  harnessProposals: (status?: HarnessProposalRow["status"]) =>
    request<HarnessProposalRow[]>(`/api/v1/features/harness-proposals${status ? `?status=${encodeURIComponent(status)}` : ""}`),
  validateHarnessProposal: (id: string) =>
    request<HarnessProposalValidation>(`/api/v1/features/harness-proposals/${id}/validate`, {
      method: "POST",
      body: JSON.stringify({}),
    }),
  approveHarnessProposal: (id: string, reviewed_by: string) =>
    request<HarnessProposalRow>(`/api/v1/features/harness-proposals/${id}/approve`, {
      method: "POST",
      body: JSON.stringify({ reviewed_by }),
    }),
  rejectHarnessProposal: (id: string, reviewed_by: string) =>
    request<HarnessProposalRow>(`/api/v1/features/harness-proposals/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ reviewed_by }),
    }),
  specGaps: (body: { project_type: string; tree: string; detected_languages?: string[]; existing_specs?: string[] }) =>
    request<{ project_type: string; gaps: SpecGap[] }>("/api/v1/spec-gaps", { method: "POST", body: JSON.stringify(body) }),
  generationPreview: (body: {
    project_type: string;
    purpose: string;
    tree: string;
    detected_languages?: string[];
    extra_context?: string;
    use_llm?: boolean;
  }) => request<GenerationPreview>("/api/v1/spec-generation/preview", { method: "POST", body: JSON.stringify(body) }),
  createGeneratedDraft: (body: {
    project_type: string;
    purpose: string;
    filename?: string;
    content: string;
    updated_by: string;
  }) => request<Spec>("/api/v1/spec-generation/draft", { method: "POST", body: JSON.stringify(body) }),
  taskPlan: (body: { project_type: string; task: string; tree?: string; token_budget?: number; use_llm?: boolean }) =>
    request<TaskPlan>("/api/v1/automation/task-plan", { method: "POST", body: JSON.stringify(body) }),
  ticketChecklist: (body: { project_type: string; task: string; tree?: string; use_llm?: boolean }) =>
    request<{ markdown: string; plan: TaskPlan }>("/api/v1/automation/ticket", { method: "POST", body: JSON.stringify(body) }),
  sectionClassifier: (body: { project_type: string }) =>
    request<{ sections: TaskPlan["sections"] }>("/api/v1/automation/section-classifier", { method: "POST", body: JSON.stringify(body) }),
  contextBudget: (body: { project_type: string; task?: string; token_budget: number }) =>
    request<TaskPlan["context_selection"]>("/api/v1/automation/context-budget", { method: "POST", body: JSON.stringify(body) }),
  auditPrompt: (spec_id: string, use_llm?: boolean, custom_guidance?: string) =>
    request<{ spec_id: string; filename: string; prompt: string }>("/api/v1/automation/audit-prompt", {
      method: "POST",
      body: JSON.stringify({ spec_id, use_llm, custom_guidance }),
    }),
  auditPromptGet: (spec_id: string) =>
    request<{ spec_id: string; filename: string; version: string; prompt: string; model: string | null; provider: string | null }>(
      `/api/v1/automation/audit-prompt/${encodeURIComponent(spec_id)}`
    ),
  updateAuditPrompt: (spec_id: string, prompt: string) =>
    requestVoid(`/api/v1/automation/audit-prompt/${encodeURIComponent(spec_id)}`, {
      method: "PUT",
      body: JSON.stringify({ prompt }),
    }),
  auditPrompts: (project_type?: string) =>
    request<{ project_type: string | null; prompts: Array<{ spec_id: string; filename: string; version: string; prompt: string }> }>(
      `/api/v1/automation/audit-prompts${project_type ? `?project_type=${encodeURIComponent(project_type)}` : ""}`
    ),
  improvementSuggestions: (body: { project_type: string; use_llm?: boolean }) =>
    request<{ suggestions: Array<{ spec_id: string; filename: string; suggestion: string; reason: string; priority: number }>; llm_notes?: string }>(
      "/api/v1/automation/improvement-suggestions",
      { method: "POST", body: JSON.stringify(body) }
    ),
  specPack: (body: { name?: string; purposes?: string[]; use_llm?: boolean }) =>
    request<{ name: string; specs: Array<{ filename: string; content: string; purpose_id: string }>; readme?: string }>("/api/v1/automation/spec-pack", {
      method: "POST",
      body: JSON.stringify(body),
    }),
};

const AUTHOR_KEY = "specregistry.author";

export function getAuthor(): string {
  // A signed-in identity wins over the free-text "acting as" name.
  return getLoginUsername() || localStorage.getItem(AUTHOR_KEY) || "anonymous";
}

export function setAuthor(name: string): void {
  localStorage.setItem(AUTHOR_KEY, name);
}
