# Git Flow Specification

## Purpose

Defines branching, merge policy, review gates, release tagging, and rollback rules for
every repository in the organization. In an AI-assisted SDLC, every ticket-driven change
must pass through a controlled delivery workflow; this specification defines that workflow
so that both humans and agents follow one traceable path from ticket to release.

## Branching

| Rule | Requirement |
| --- | --- |
| Branch naming | Branches are named `type/ticket-id-short-slug` (e.g. `fix/PLT-1421-udp-timeout`). |
| Branch source | Feature and fix branches are cut from the current default branch head. |
| One ticket per branch | A branch implements exactly one approved ticket. |
| No direct commits | The default and release branches accept changes only through pull requests. |

## Pull Requests & Review Gates

1. Every change reaches the default branch through a pull request linked to its ticket.
2. A PR must pass build validation, required unit and contract tests, and static analysis
   before it is eligible for review.
3. Code review is mandatory and must record an explicit rationale for why the change is
   approved or rejected — review is not a silent thumbs-up.
4. An agent-authored PR rejected more than the configured retry limit is escalated to a
   human-in-the-loop owner.

## Rebasing & Merge Control

- Branches are kept current by rebasing onto the default branch before merge.
- Merges to the default branch use a single squashed, well-described commit referencing
  the ticket id.
- Merges to a release branch require the additional gates defined by the release process.

## Release Tagging

Releases are tagged with semantic versions (`MAJOR.MINOR.PATCH`). The tag message records
the tickets included and a link to the validation evidence for the release.

## Rollback

| Requirement | Rule |
| --- | --- |
| Revertability | Every merged change must be revertable as a discrete unit. |
| Rollback plan | High-risk and hardware-impacting changes must document a rollback plan in the ticket before merge. |
| Recorded rollbacks | A rollback is itself a tracked, reviewed change with its own audit trail. |

## AI Agent Directives

Agents must never push directly to a protected branch, never merge their own PR without a
human approval, and must keep each PR scoped to a single ticket so the delivery trail stays
auditable.
