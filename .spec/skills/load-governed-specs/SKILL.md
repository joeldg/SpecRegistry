---
name: load-governed-specs
description: "Load the current global, project-type, and project-scoped specifications before implementation work."
metadata:
  specregistry_id: builtin-load-governed-specs
  risk_level: safe
  source_candidate_id: 
  source_url: 
  source_path: 
  source_commit: 
  upstream_content_hash: 
---

# Load governed specs

Load the current global, project-type, and project-scoped specifications before implementation work.

## Instructions

Before non-trivial work, call begin_task to register the session, then use the SpecRegistry MCP get_specs tool for the configured project type and repository to load the governed bundle. Check the local manifest for drift. Treat published specs as authoritative and do not treat drafts as approved guidance.

## Safety Boundary

This skill is a governed operating procedure, not permission to take external or destructive
actions. Follow the agent host's approval policy, current published specifications, and the
principle of least privilege. Stop and ask when required authorization or intent is unclear.
