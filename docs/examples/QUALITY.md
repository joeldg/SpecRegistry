---
title: SpecRegistry Quality Model
description: >
  A worked, filled-in QUALITY.md for the SpecRegistry project itself. It is a real
  example of the QUALITY.md format (https://getquality.md/specification) validated with
  `qualitymd lint`, and it doubles as a reference you can copy when generating your own
  via the `quality-model` purpose in the Generate Specs workbench. The frontmatter is
  spec-compliant QUALITY.md; the body adds the AI Agent Directives section every governed
  SpecRegistry spec carries.
ratingScale:
  - level: outstanding
    title: 🟢 Outstanding
    description: "The stretch band — reached only with deliberate extra effort."
    criterion: "Exceeds the requirement with margin a maintainer can verify."
  - level: target
    title: 🔵 Target
    description: "The expected good state — the requirement is satisfied."
    criterion: "Satisfies the requirement with evidence a maintainer can verify."
  - level: minimum
    title: 🟡 Minimum
    description: "The acceptable floor — short of the goal but still safe to rely on."
    criterion: "Falls short of target with visible gaps, while remaining acceptable."
  - level: unacceptable
    title: 🔴 Unacceptable
    description: "Below the floor — not good enough to rely on."
    criterion: "Does not meet the requirement to an acceptable degree."
factors:
  governance-integrity:
    title: Governance Integrity
    description: >
      The central promise of the registry holds: an agent cannot approve or publish its
      own change to a governed spec, privilege escalation is refused server-side, and
      separation of duties is enforced rather than merely advised. Maintainers and every
      downstream consumer depend on this.
    requirements:
      agents-cannot-self-approve:
        title: an enrolled agent identity cannot approve, publish, or escalate to admin
        assessment: >
          Run the "agent identity, scope, and separation of duties" and "secured posture"
          suites in packages/server/test/platform.test.ts; confirm agent-role tokens are
          rejected from approve/publish routes and the server refuses to boot with the
          default admin password when SPECREG_AUTH=required.
      governed-specs-change-only-through-review:
        title: published global and project-type specs change only through the review workflow
        assessment: >
          Confirm assertAgentScope in packages/server/src/routes/specs.ts blocks agent
          edits to non-project-scoped specs, and that a reviewer cannot approve a change
          they proposed (separation-of-duties check in routes/reviews.ts), both covered by
          the platform test suite.
  change-safety:
    title: Change Safety
    description: >
      Schema and dependency changes preserve existing data and operator customizations,
      and the automated suite gates regressions. The people running an upgrade depend on
      an in-place update never silently losing state.
    requirements:
      migrations-preserve-data-and-operator-edits:
        title: schema migrations preserve existing rows and admin-customized built-ins
        assessment: >
          Run packages/server/test/migrations.test.ts; confirm each rebuild-style
          migration is gated so an operator's customized built-in (e.g. an edited skill)
          survives, and pre-existing rows carry forward with the new columns.
      the-suite-gates-regressions:
        title: the full test suite passes on the supported Node runtimes before release
        assessment: >
          Run `npm test --workspaces`; confirm the server and CLI suites pass. The
          better-sqlite3 native module must load on the active Node version (the
          predev/pretest ensure-native self-heal is the safety net for ABI drift).
  provenance-and-distribution:
    title: Provenance and Distribution
    description: >
      Governed spec content that reaches a consuming repo is verifiably the approved
      content, and drift from the registry is detectable in CI. Consumers rely on trusting
      a synced bundle without re-reviewing it by hand.
    requirements:
      bundles-are-signed-and-verifiable:
        title: download bundles carry per-file hashes and an ed25519 signature that clients verify
        assessment: >
          Confirm `specreg check` and `specreg verify` validate the manifest signature
          against /api/v1/meta/public-key and fail on any per-file SHA-256 mismatch; the
          signed-bundle behavior is exercised in packages/server/test/platform.test.ts.
  agent-harnessability:
    title: Agent Harnessability
    description: >
      How well the project equips an AI agent to load the right context, stay within
      governed boundaries, and prove its work is compliant before claiming completion —
      distinct from whether any single spec is correct.
    requirements:
      agents-reach-governed-context-from-a-stable-entry-point:
        title: a fresh agent reaches governed specs and operating rules through the MCP server
        assessment: >
          From a repo initialized with `specreg init`, confirm .mcp.json plus the
          begin_task / get_specs / resolve_guidance tools return the governed bundle and
          the AGENT_OPERATING_RULES baseline without private context.
      completion-is-gated-by-objective-compliance:
        title: an agent cannot mark work complete while the objective compliance gate fails
        assessment: >
          Run the "compliance verification loop" and "agent lifecycle control plane"
          suites in packages/server/test/features.test.ts; confirm finish_task blocks
          completion until measured coverage/drift satisfy the project-type policy.
---

# SpecRegistry Quality Model

## Overview

SpecRegistry is a control plane for AI coding agents: Markdown specs are versioned,
reviewed, signed, and distributed to repos and agents. "Good" for the people who rely on
it means the governance promises actually hold under an adversarial agent, upgrades never
lose data, distributed content is provably the approved content, and an agent is equipped
to work inside the fence rather than around it.

_Unknowns_ — how the model should weight LLM-backed automation features whose output is
non-deterministic and not gated by the objective compliance loop.
_Open questions_ — should the harness area eventually rate the generated agent-context
files (CLAUDE.md / AGENTS.md) as artifacts in their own right?

_Reviewed — none yet; agent-reviewed — Claude, 2026-07._

## Scope

This model covers the registry server, its governance/distribution behavior, the `specreg`
CLI and MCP surface, and this quality model itself. It deliberately excludes the
correctness of any individual governed spec's *content* (that is each spec's own concern),
the external `qualitymd` evaluation engine, and deployment topology. Those exclusions are
boundary choices, not claims the concerns never matter.

_Unknowns_ — none known.
_Open questions_ — should CLI-only workflows (no server) get their own area?

_Reviewed — none yet; agent-reviewed — Claude, 2026-07._

## Needs

Maintainers need the governance guarantees to be server-enforced and test-covered, not
advisory. Operators need upgrades to be safe in place. Downstream consumers need to trust a
synced bundle without re-reviewing it. Agents need to find and obey governed context and to
have their completion claims checked objectively.

_Unknowns_ — none known.
_Open questions_ — none.

_Reviewed — none yet; agent-reviewed — Claude, 2026-07._

## Risks

If governance integrity slips, an agent self-approves a change to a shared spec and the
registry silently stops being a control plane. If change safety slips, an upgrade drops
attestations or an operator's customizations. If provenance slips, a consumer trusts
tampered or drifted content. If harnessability slips, agents route around the specs and the
whole loop degrades to unenforced advice.

_Unknowns_ — the blast radius of a compromised admin token is not modeled here.
_Open questions_ — should token expiry/rotation be a governance-integrity requirement once
it exists? (Currently tracked as a gap in docs/TODO.md.)

_Reviewed — none yet; agent-reviewed — Claude, 2026-07._

## AI Agent Directives

Agents evaluating or improving this quality model must ground every finding in this
repository's actual evidence — cite the specific test, route, or command named in the
requirement's assessment, not a general impression. Cite the requirement id for each
finding. If a requirement is vague, stale, or no longer assessable against the code, call
report_spec_feedback instead of quietly loosening its assessment method, and propose any
change to this model through the normal review workflow. Do not hand-edit a published copy
of this file directly. Run the actual evaluation with the external `qualitymd` CLI or the
`/quality` agent skill; SpecRegistry governs this rubric's content and history, it does not
run the evaluation itself.
