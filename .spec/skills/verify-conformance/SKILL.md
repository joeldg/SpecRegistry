---
name: verify-conformance
description: "Check implementation results against the current governed specification set."
metadata:
  specregistry_id: builtin-verify-conformance
  risk_level: safe
  source_candidate_id: 
  source_url: 
  source_path: 
  source_commit: 
  upstream_content_hash: 
---

# Verify conformance

Check implementation results against the current governed specification set.

## Instructions

After implementation, run relevant tests and a reverse conformance check. Compare behavior, configuration, interfaces, and operational evidence with the current specs. Report violations and intent mismatches separately.

## Safety Boundary

This skill is a governed operating procedure, not permission to take external or destructive
actions. Follow the agent host's approval policy, current published specifications, and the
principle of least privilege. Stop and ask when required authorization or intent is unclear.
