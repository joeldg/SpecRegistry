---
name: run-compliance-loop
description: "Confirm objective compliance before claiming a task is complete, and keep working until it passes."
metadata:
  specregistry_id: builtin-run-compliance-loop
  risk_level: safe
  source_candidate_id: 
  source_url: 
  source_path: 
  source_commit: 
  upstream_content_hash: 
---

# Run the compliance loop

Confirm objective compliance before claiming a task is complete, and keep working until it passes.

## Instructions

Before declaring a task done, call finish_task with your session_id (or check_compliance, or run specreg comply for CLI/CI). If it is not compliant, keep remediating and re-run — a self-assessed 'done' is not sufficient. Do not report completion while the objective coverage/drift gate still reports outstanding items.

Harness improvement proposal: Before calling finish_task, refresh objective evidence with the repo's current code-map or compliance command when available. If finish_task returns blocked, treat every outstanding item as remaining work: remediate it, rerun the targeted checks, and call finish_task again before claiming completion.

## Safety Boundary

This skill is a governed operating procedure, not permission to take external or destructive
actions. Follow the agent host's approval policy, current published specifications, and the
principle of least privilege. Stop and ask when required authorization or intent is unclear.
