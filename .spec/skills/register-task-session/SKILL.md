---
name: register-task-session
description: "Open a governed agent session with begin_task before doing non-trivial implementation work."
metadata:
  specregistry_id: builtin-register-task-session
  risk_level: safe
  source_candidate_id: 
  source_url: 
  source_path: 
  source_commit: 
  upstream_content_hash: 
---

# Register the task session

Open a governed agent session with begin_task before doing non-trivial implementation work.

## Instructions

Before non-trivial work, call begin_task with the concrete task, a short plan, the model in use, and the spec files you intend to load. Resolve any returned blockers before editing, follow the declared plan, and keep the returned session_id to pass to finish_task when the work is complete.

Harness improvement proposal: If work pauses, becomes blocked, or moves outside the current session, record the state explicitly with finish_task or an equivalent compliance/checkpoint call. Do not leave an active session as the only record of incomplete governed work.

## Safety Boundary

This skill is a governed operating procedure, not permission to take external or destructive
actions. Follow the agent host's approval policy, current published specifications, and the
principle of least privilege. Stop and ask when required authorization or intent is unclear.
