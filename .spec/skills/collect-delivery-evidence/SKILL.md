---
name: collect-delivery-evidence
description: "Record the tests, checks, and operational evidence that support a completed change."
metadata:
  specregistry_id: builtin-collect-delivery-evidence
  risk_level: safe
  source_candidate_id: 
  source_url: 
  source_path: 
  source_commit: 
  upstream_content_hash: 
---

# Collect delivery evidence

Record the tests, checks, and operational evidence that support a completed change.

## Instructions

Summarize commands run, test outcomes, affected specs, known residual risks, and any unverified requirement. Before creating a git commit for implementation work, include compact compliance evidence in the commit message body: the SpecRegistry-Compliance, SpecRegistry-Signals, and SpecRegistry-Command trailer emitted by specreg comply, or equivalent finish_task evidence with verdict, objective score, and session id. Do not claim a check passed unless it was actually executed and its result observed.

## Safety Boundary

This skill is a governed operating procedure, not permission to take external or destructive
actions. Follow the agent host's approval policy, current published specifications, and the
principle of least privilege. Stop and ask when required authorization or intent is unclear.
