---
name: resolve-uncovered-guidance
description: "Pull governed guidance before writing in a language or domain the loaded specs do not cover."
metadata:
  specregistry_id: builtin-resolve-uncovered-guidance
  risk_level: safe
  source_candidate_id: 
  source_url: 
  source_path: 
  source_commit: 
  upstream_content_hash: 
---

# Resolve uncovered guidance

Pull governed guidance before writing in a language or domain the loaded specs do not cover.

## Instructions

Before writing in a language, or working in a domain (networking, authentication, database, deployment) the loaded specs do not clearly cover, call resolve_guidance. Pull the styleguides and specs it returns. If it reports a coverage gap, call report_spec_feedback with error_type missing_guidance plus the relevant languages/topic instead of inventing a standard.

## Safety Boundary

This skill is a governed operating procedure, not permission to take external or destructive
actions. Follow the agent host's approval policy, current published specifications, and the
principle of least privilege. Stop and ask when required authorization or intent is unclear.
