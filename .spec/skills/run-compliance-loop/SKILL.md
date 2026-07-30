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

Before declaring a task done, call finish_task with your session_id (or check_compliance, or run specreg comply for CLI/CI). If it is not compliant, remediate with targeted evidence only: add @spec[FILE#section] annotations only when the code entity is truly governed by that exact section, and never blanket-map files to PROJECT_PROFILE.md or broad requirements just to raise coverage. If no section governs the behavior, report missing_guidance or propose the needed spec. If repeated compliance attempts still fail, halt autonomous remediation and show the user the exact latest output. Before creating a git commit for implementation work, include the compact SpecRegistry-Compliance/SpecRegistry-Signals/SpecRegistry-Command trailer emitted by specreg comply, or equivalent finish_task evidence. Do not report completion while objective compliance is failing or unavailable.

## Safety Boundary

This skill is a governed operating procedure, not permission to take external or destructive
actions. Follow the agent host's approval policy, current published specifications, and the
principle of least privilege. Stop and ask when required authorization or intent is unclear.
