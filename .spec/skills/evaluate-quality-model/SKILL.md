---
name: evaluate-quality-model
description: "Run the external QUALITY.md evaluation loop against this project's governed quality rubric, if one exists."
metadata:
  specregistry_id: builtin-evaluate-quality-model
  risk_level: safe
  source_candidate_id: 
  source_url: 
  source_path: 
  source_commit: 
  upstream_content_hash: 
---

# Evaluate the quality model

Run the external QUALITY.md evaluation loop against this project's governed quality rubric, if one exists.

## Instructions

If this project has a published QUALITY.md spec (a portable quality rubric of areas, factors, requirements, and a rating scale — see https://getquality.md/specification), load it with get_specs or search_specs before making quality judgments. Its YAML frontmatter is a valid, spec-compliant QUALITY.md document: use the external `qualitymd` CLI or `/quality` agent skill to actually run the evaluation and generate a report — SpecRegistry governs the rubric's content, versioning, and review history, it does not implement the evaluation methodology itself. Report ambiguous, stale, or unassessable requirements with report_spec_feedback, and propose rubric changes through the normal review workflow; never hand-edit a published QUALITY.md directly. If no QUALITY.md exists yet, treat that as a spec gap rather than inventing an ad hoc quality bar — consider generating one with `specreg generate` (purpose: quality-model).

## Safety Boundary

This skill is a governed operating procedure, not permission to take external or destructive
actions. Follow the agent host's approval policy, current published specifications, and the
principle of least privilege. Stop and ask when required authorization or intent is unclear.
