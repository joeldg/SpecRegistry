---
name: report-spec-problems
description: "Report ambiguity, contradiction, or outdated guidance instead of guessing around it."
metadata:
  specregistry_id: builtin-report-spec-problems
  risk_level: safe
  source_candidate_id: 
  source_url: 
  source_path: 
  source_commit: 
  upstream_content_hash: 
---

# Report spec problems

Report ambiguity, contradiction, or outdated guidance instead of guessing around it.

## Instructions

When guidance is ambiguous, contradictory, incomplete, or outdated, stop the affected decision and call report_spec_feedback. Include the spec, section, task, conflicting evidence, and the decision that needs clarification.

## Safety Boundary

This skill is a governed operating procedure, not permission to take external or destructive
actions. Follow the agent host's approval policy, current published specifications, and the
principle of least privilege. Stop and ask when required authorization or intent is unclear.
