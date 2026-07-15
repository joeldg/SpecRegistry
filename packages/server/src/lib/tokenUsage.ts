import type { Db } from "../db.js";
import { now, uuid } from "../db.js";
import { sectionAnchor, splitSections } from "./sections.js";
import type { SearchResult } from "./search.js";

export const TOKEN_ESTIMATOR = "chars/4:v1";

type ContextSection = {
  spec_id: string;
  spec_version?: string | null;
  filename: string;
  section_title: string;
  section_anchor: string;
  content: string;
};

type ContextEventInput = {
  project_type_id?: string | null;
  consumer_id?: string | null;
  repo?: string | null;
  agent_session_id?: string | null;
  event_type: string;
  source?: string | null;
  detail?: string | null;
  actor?: string | null;
  sections: ContextSection[];
};

export function estimateTokens(value: string): number {
  return Math.max(1, Math.ceil(value.length / 4));
}

export function sectionsFromSpecs(
  specs: Array<{ id: string; filename: string; current_version?: string | null; content: string }>
): ContextSection[] {
  return specs.flatMap((spec) =>
    splitSections(spec.content).map((section) => ({
      spec_id: spec.id,
      spec_version: spec.current_version ?? null,
      filename: spec.filename,
      section_title: section.section,
      section_anchor: section.anchor,
      content: section.text,
    }))
  );
}

export function sectionsFromSearchResults(db: Db, results: SearchResult[]): ContextSection[] {
  if (results.length === 0) return [];
  const readChunk = db.prepare("SELECT content FROM spec_chunks WHERE spec_id = ? AND section = ? LIMIT 1");
  return results.map((result) => {
    const chunk = readChunk.get(result.spec_id, result.section) as { content: string } | undefined;
    const content = chunk?.content ?? result.excerpt ?? result.section;
    return {
      spec_id: result.spec_id,
      spec_version: result.current_version ?? null,
      filename: result.filename,
      section_title: result.section,
      section_anchor: result.section_anchor || sectionAnchor(result.section),
      content,
    };
  });
}

export function recordContextEvent(db: Db, input: ContextEventInput): string | null {
  if (input.sections.length === 0) return null;
  const eventId = uuid();
  const ts = now();
  const sectionRows = input.sections.map((section) => ({
    ...section,
    chars: section.content.length,
    estimated_tokens: estimateTokens(section.content),
  }));
  const totalTokens = sectionRows.reduce((sum, section) => sum + section.estimated_tokens, 0);
  const insertEvent = db.prepare(
    `INSERT INTO context_events
      (id, project_type_id, consumer_id, repo, agent_session_id, event_type, source, detail, actor,
       estimated_tokens, section_count, tokenizer, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertSection = db.prepare(
    `INSERT INTO context_event_sections
      (id, context_event_id, spec_id, spec_version, filename, section_title, section_anchor,
       chars, estimated_tokens, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  db.transaction(() => {
    insertEvent.run(
      eventId,
      input.project_type_id ?? null,
      input.consumer_id ?? null,
      input.repo ?? null,
      input.agent_session_id ?? null,
      input.event_type,
      input.source ?? null,
      input.detail ?? null,
      input.actor ?? null,
      totalTokens,
      sectionRows.length,
      TOKEN_ESTIMATOR,
      ts
    );
    for (const section of sectionRows) {
      insertSection.run(
        uuid(),
        eventId,
        section.spec_id,
        section.spec_version ?? null,
        section.filename,
        section.section_title,
        section.section_anchor,
        section.chars,
        section.estimated_tokens,
        ts
      );
    }
  })();
  return eventId;
}

function dateFilter(days: number): string {
  const since = new Date(Date.now() - Math.max(1, days) * 24 * 60 * 60 * 1000);
  return since.toISOString();
}

type TokenUsageReportOptions = {
  project_id?: string;
  days?: number;
  event_type?: string;
  agent_session_id?: string;
  provider?: string;
  model?: string;
  spec_id?: string;
  section?: string;
};

function addFilter(parts: string[], params: unknown[], value: string | undefined, sql: string) {
  if (!value?.trim()) return;
  parts.push(sql);
  params.push(value.trim());
}

export function tokenUsageReport(db: Db, opts: TokenUsageReportOptions) {
  const days = Math.max(1, Math.min(3650, Number(opts.days ?? 30) || 30));
  const since = dateFilter(days);

  const contextFilters = ["ce.created_at >= ?"];
  const contextParams: unknown[] = [since];
  addFilter(contextFilters, contextParams, opts.project_id, "ce.consumer_id = ?");
  addFilter(contextFilters, contextParams, opts.event_type, "ce.event_type = ?");
  addFilter(contextFilters, contextParams, opts.agent_session_id, "ce.agent_session_id = ?");

  const sectionFilters = [...contextFilters];
  const sectionParams = [...contextParams];
  addFilter(sectionFilters, sectionParams, opts.spec_id, "ces.spec_id = ?");
  addFilter(sectionFilters, sectionParams, opts.section, "ces.section_anchor = ?");

  const llmFilters = ["created_at >= ?"];
  const llmParams: unknown[] = [since];
  addFilter(llmFilters, llmParams, opts.project_id, "consumer_id = ?");
  addFilter(llmFilters, llmParams, opts.agent_session_id, "agent_session_id = ?");
  addFilter(llmFilters, llmParams, opts.provider, "provider = ?");
  addFilter(llmFilters, llmParams, opts.model, "model = ?");

  const llmAliasFilters = ["lr.created_at >= ?"];
  const llmAliasParams: unknown[] = [since];
  addFilter(llmAliasFilters, llmAliasParams, opts.project_id, "lr.consumer_id = ?");
  addFilter(llmAliasFilters, llmAliasParams, opts.agent_session_id, "lr.agent_session_id = ?");
  addFilter(llmAliasFilters, llmAliasParams, opts.provider, "lr.provider = ?");
  addFilter(llmAliasFilters, llmAliasParams, opts.model, "lr.model = ?");

  const projectRows = db
    .prepare(
      `SELECT rc.id AS project_id, rc.repo, pt.name AS project_type_name,
              COUNT(DISTINCT ce.id) AS context_events,
              COALESCE(SUM(ce.estimated_tokens), 0) AS projected_tokens,
              COALESCE(SUM(ce.section_count), 0) AS delivered_sections,
              COALESCE(llm.prompt_tokens, 0) AS real_prompt_tokens,
              COALESCE(llm.completion_tokens, 0) AS real_completion_tokens,
              COALESCE(llm.total_tokens, 0) AS real_total_tokens,
              COALESCE(llm.total_cost_usd, 0) AS total_cost_usd,
              MAX(COALESCE(ce.created_at, llm.last_reported_at)) AS last_reported_at
       FROM repo_consumers rc
       JOIN project_types pt ON pt.id = rc.project_type_id
       LEFT JOIN context_events ce ON ce.consumer_id = rc.id AND ce.created_at >= ?
       LEFT JOIN (
         SELECT consumer_id,
                SUM(prompt_tokens) AS prompt_tokens,
                SUM(completion_tokens) AS completion_tokens,
                SUM(total_tokens) AS total_tokens,
                SUM(COALESCE(total_cost_usd, 0)) AS total_cost_usd,
                MAX(created_at) AS last_reported_at
         FROM llm_usage_reports
         WHERE ${llmFilters.join(" AND ")}
         GROUP BY consumer_id
       ) llm ON llm.consumer_id = rc.id
       ${opts.project_id ? "WHERE rc.id = ?" : ""}
       GROUP BY rc.id
       ORDER BY projected_tokens DESC, real_total_tokens DESC, rc.last_seen_at DESC`
    )
    .all(since, ...llmParams, ...(opts.project_id ? [opts.project_id] : []));

  const bySpec = db
    .prepare(
      `SELECT ces.spec_id, ces.filename, MAX(ces.spec_version) AS spec_version,
              COUNT(DISTINCT ce.id) AS context_events,
              COUNT(*) AS delivered_sections,
              SUM(ces.chars) AS chars,
              SUM(ces.estimated_tokens) AS projected_tokens,
              MAX(ce.created_at) AS last_delivered_at
       FROM context_event_sections ces
       JOIN context_events ce ON ce.id = ces.context_event_id
       WHERE ${sectionFilters.join(" AND ")}
       GROUP BY ces.spec_id, ces.filename
       ORDER BY projected_tokens DESC, delivered_sections DESC
       LIMIT 100`
    )
    .all(...sectionParams);

  const bySection = db
    .prepare(
      `SELECT ces.spec_id, ces.filename, MAX(ces.spec_version) AS spec_version,
              ces.section_title, ces.section_anchor,
              COUNT(DISTINCT ce.id) AS context_events,
              COUNT(*) AS deliveries,
              SUM(ces.chars) AS chars,
              SUM(ces.estimated_tokens) AS projected_tokens,
              MAX(ce.created_at) AS last_delivered_at
       FROM context_event_sections ces
       JOIN context_events ce ON ce.id = ces.context_event_id
       WHERE ${sectionFilters.join(" AND ")}
       GROUP BY ces.spec_id, ces.filename, ces.section_anchor
       ORDER BY projected_tokens DESC, deliveries DESC
       LIMIT 200`
    )
    .all(...sectionParams);
  const specContent = db.prepare("SELECT content FROM specs WHERE id = ?");
  const bySectionWithPreview = (bySection as Array<Record<string, unknown>>).map((row) => {
    const spec = specContent.get(row.spec_id) as { content: string } | undefined;
    const anchor = String(row.section_anchor ?? "");
    const section = spec ? splitSections(spec.content).find((candidate) => candidate.anchor === anchor) : undefined;
    const preview = section?.text.replace(/\s+/g, " ").trim().slice(0, 220) ?? "";
    return { ...row, section_preview: preview };
  });

  const byEventType = db
    .prepare(
      `SELECT ce.event_type, COUNT(*) AS context_events,
              SUM(ce.section_count) AS delivered_sections,
              SUM(ce.estimated_tokens) AS projected_tokens,
              MAX(ce.created_at) AS last_delivered_at
       FROM context_events ce
       WHERE ${contextFilters.join(" AND ")}
       GROUP BY ce.event_type
       ORDER BY projected_tokens DESC`
    )
    .all(...contextParams);

  const sessions = db
    .prepare(
      `SELECT ce.agent_session_id, COALESCE(ags.task, ce.detail, 'unreported task') AS task,
              COALESCE(ags.repo, ce.repo) AS repo,
              COUNT(*) AS context_events,
              SUM(ce.section_count) AS delivered_sections,
              SUM(ce.estimated_tokens) AS projected_tokens,
              MAX(ce.created_at) AS last_delivered_at
       FROM context_events ce
       LEFT JOIN agent_sessions ags ON ags.id = ce.agent_session_id
       WHERE ${contextFilters.join(" AND ")} AND ce.agent_session_id IS NOT NULL
       GROUP BY ce.agent_session_id
       ORDER BY projected_tokens DESC
       LIMIT 100`
    )
    .all(...contextParams);

  const realUsage = db
    .prepare(
      `SELECT provider, model, route,
              COUNT(*) AS reports,
              SUM(prompt_tokens) AS prompt_tokens,
              SUM(completion_tokens) AS completion_tokens,
              SUM(total_tokens) AS total_tokens,
              SUM(cached_tokens) AS cached_tokens,
              SUM(COALESCE(total_cost_usd, 0)) AS total_cost_usd,
              MAX(created_at) AS last_reported_at
       FROM llm_usage_reports
       WHERE ${llmFilters.join(" AND ")}
       GROUP BY provider, model, route
       ORDER BY total_tokens DESC`
    )
    .all(...llmParams);

  const trendRows = db
    .prepare(
      `WITH days AS (
         SELECT date(created_at) AS day,
                SUM(estimated_tokens) AS projected_tokens,
                SUM(section_count) AS delivered_sections,
                COUNT(*) AS context_events,
                0 AS real_prompt_tokens,
                0 AS real_completion_tokens,
                0 AS real_total_tokens,
                0 AS reports,
                0 AS total_cost_usd
         FROM context_events ce
         WHERE ${contextFilters.join(" AND ")}
         GROUP BY date(created_at)
         UNION ALL
         SELECT date(created_at) AS day,
                0 AS projected_tokens,
                0 AS delivered_sections,
                0 AS context_events,
                SUM(prompt_tokens) AS real_prompt_tokens,
                SUM(completion_tokens) AS real_completion_tokens,
                SUM(total_tokens) AS real_total_tokens,
                COUNT(*) AS reports,
                SUM(COALESCE(total_cost_usd, 0)) AS total_cost_usd
         FROM llm_usage_reports lr
         WHERE ${llmAliasFilters.join(" AND ")}
         GROUP BY date(created_at)
       )
       SELECT day,
              SUM(projected_tokens) AS projected_tokens,
              SUM(delivered_sections) AS delivered_sections,
              SUM(context_events) AS context_events,
              SUM(real_prompt_tokens) AS real_prompt_tokens,
              SUM(real_completion_tokens) AS real_completion_tokens,
              SUM(real_total_tokens) AS real_total_tokens,
              SUM(reports) AS reports,
              SUM(total_cost_usd) AS total_cost_usd
       FROM days
       GROUP BY day
       ORDER BY day`
    )
    .all(...contextParams, ...llmAliasParams);

  return {
    generated_at: now(),
    window_days: days,
    project_id: opts.project_id ?? null,
    tokenizer: TOKEN_ESTIMATOR,
    projects: projectRows,
    by_spec: bySpec,
    by_section: bySectionWithPreview,
    by_event_type: byEventType,
    sessions,
    real_usage: realUsage,
    trend: trendRows,
  };
}

export function recordLlmUsageReport(
  db: Db,
  input: {
    project_type_id?: string | null;
    consumer_id?: string | null;
    repo?: string | null;
    agent_session_id?: string | null;
    provider?: string | null;
    model?: string | null;
    route?: string | null;
    prompt_tokens?: number | null;
    completion_tokens?: number | null;
    total_tokens?: number | null;
    cached_tokens?: number | null;
    input_cost_usd?: number | null;
    output_cost_usd?: number | null;
    total_cost_usd?: number | null;
    latency_ms?: number | null;
    related_context_event_ids?: string[];
    detail?: string | null;
    actor?: string | null;
  }
): string | null {
  const promptTokens = Math.max(0, Math.floor(Number(input.prompt_tokens ?? 0) || 0));
  const completionTokens = Math.max(0, Math.floor(Number(input.completion_tokens ?? 0) || 0));
  const totalTokens = Math.max(promptTokens + completionTokens, Math.floor(Number(input.total_tokens ?? 0) || 0));
  if (totalTokens === 0) return null;
  const id = uuid();
  db.prepare(
    `INSERT INTO llm_usage_reports
      (id, project_type_id, consumer_id, repo, agent_session_id, provider, model, route,
       prompt_tokens, completion_tokens, total_tokens, cached_tokens, input_cost_usd,
       output_cost_usd, total_cost_usd, latency_ms, related_context_event_ids, detail, actor, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.project_type_id ?? null,
    input.consumer_id ?? null,
    input.repo ?? null,
    input.agent_session_id ?? null,
    input.provider ?? null,
    input.model ?? null,
    input.route ?? null,
    promptTokens,
    completionTokens,
    totalTokens,
    Math.max(0, Math.floor(Number(input.cached_tokens ?? 0) || 0)),
    input.input_cost_usd ?? null,
    input.output_cost_usd ?? null,
    input.total_cost_usd ?? null,
    input.latency_ms == null ? null : Math.max(0, Math.floor(Number(input.latency_ms) || 0)),
    JSON.stringify(input.related_context_event_ids ?? []),
    input.detail ?? null,
    input.actor ?? null,
    now()
  );
  return id;
}

function csvCell(value: unknown): string {
  const text = value == null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function tokenUsageCsv(report: ReturnType<typeof tokenUsageReport>): string {
  const rows: unknown[][] = [
    [
      "record_type",
      "project",
      "project_type",
      "spec",
      "section",
      "event_type",
      "provider",
      "model",
      "route",
      "projected_tokens",
      "real_prompt_tokens",
      "real_completion_tokens",
      "real_total_tokens",
      "delivered_sections",
      "events_or_reports",
      "last_seen",
    ],
  ];
  for (const row of report.projects as Array<Record<string, unknown>>) {
    rows.push([
      "project",
      row.repo,
      row.project_type_name,
      "",
      "",
      "",
      "",
      "",
      "",
      row.projected_tokens,
      row.real_prompt_tokens,
      row.real_completion_tokens,
      row.real_total_tokens,
      row.delivered_sections,
      row.context_events,
      row.last_reported_at,
    ]);
  }
  for (const row of report.by_spec as Array<Record<string, unknown>>) {
    rows.push(["spec", "", "", row.filename, "", "", "", "", "", row.projected_tokens, "", "", "", row.delivered_sections, row.context_events, row.last_delivered_at]);
  }
  for (const row of report.by_section as Array<Record<string, unknown>>) {
    rows.push(["section", "", "", row.filename, row.section_title, "", "", "", "", row.projected_tokens, "", "", "", row.deliveries, row.context_events, row.last_delivered_at]);
  }
  for (const row of report.by_event_type as Array<Record<string, unknown>>) {
    rows.push(["retrieval", "", "", "", "", row.event_type, "", "", "", row.projected_tokens, "", "", "", row.delivered_sections, row.context_events, row.last_delivered_at]);
  }
  for (const row of report.sessions as Array<Record<string, unknown>>) {
    rows.push(["session", row.repo, "", "", row.task, "", "", "", "", row.projected_tokens, "", "", "", row.delivered_sections, row.context_events, row.last_delivered_at]);
  }
  for (const row of report.real_usage as Array<Record<string, unknown>>) {
    rows.push(["real_usage", "", "", "", "", "", row.provider, row.model, row.route, "", row.prompt_tokens, row.completion_tokens, row.total_tokens, "", row.reports, row.last_reported_at]);
  }
  for (const row of report.trend as Array<Record<string, unknown>>) {
    rows.push(["trend", "", "", "", "", "", "", "", "", row.projected_tokens, row.real_prompt_tokens, row.real_completion_tokens, row.real_total_tokens, row.delivered_sections, row.context_events, row.day]);
  }
  return rows.map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
}
