import type { Db } from "../db.js";
import { now, uuid } from "../db.js";

export type WebhookEvent =
  | "spec.published"
  | "review.submitted"
  | "review.approved"
  | "review.rejected"
  | "feedback.created";

interface WebhookRow {
  id: string;
  url: string;
  events: string;
  format: "json" | "slack" | "gchat";
  active: number;
}

/** Slack Block Kit payload; pending reviews get interactive approve/reject buttons. */
function slackPayload(event: WebhookEvent, summary: string, data: Record<string, unknown>) {
  const text = `*SpecRegistry* · ${event}\n${summary}`;
  if (event !== "review.submitted" || !data.change_request_id) {
    return { text };
  }
  // Buttons require a Slack app with interactivity pointed at /api/v1/integrations/slack/actions.
  return {
    text,
    blocks: [
      { type: "section", text: { type: "mrkdwn", text } },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "Approve" },
            style: "primary",
            action_id: "specreg_approve",
            value: `approve:${data.change_request_id}`,
          },
          {
            type: "button",
            text: { type: "plain_text", text: "Reject" },
            style: "danger",
            action_id: "specreg_reject",
            value: `reject:${data.change_request_id}`,
          },
        ],
      },
    ],
  };
}

/**
 * Deliver an event to every active webhook subscribed to it. Failures are logged
 * and swallowed — notification delivery must never fail the originating request.
 */
export async function dispatchWebhooks(
  db: Db,
  event: WebhookEvent,
  summary: string,
  data: Record<string, unknown>
): Promise<void> {
  const hooks = (db.prepare("SELECT * FROM webhooks WHERE active = 1").all() as WebhookRow[]).filter(
    (h) => {
      const events: string[] = JSON.parse(h.events);
      return events.length === 0 || events.includes(event);
    }
  );

  await Promise.all(
    hooks.map(async (hook) => {
      const body =
        hook.format === "slack"
          ? slackPayload(event, summary, data)
          : hook.format === "gchat"
            ? { text: `*SpecRegistry* · ${event}\n${summary}` } // Google Chat incoming-webhook format
            : { event, summary, data, timestamp: now() };
      try {
        await fetch(hook.url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(5000),
        });
      } catch (err) {
        console.error(`Webhook delivery failed (${hook.url}):`, err instanceof Error ? err.message : err);
      }
    })
  );
}

export type UsageEventType = "download" | "agent_read" | "search" | "stub_prompts" | "sync_check";

export function recordUsage(db: Db, type: UsageEventType, projectTypeId?: string, detail?: string): void {
  db.prepare(
    "INSERT INTO usage_events (id, event_type, project_type_id, detail, created_at) VALUES (?, ?, ?, ?, ?)"
  ).run(uuid(), type, projectTypeId ?? null, detail ?? null, now());
}
