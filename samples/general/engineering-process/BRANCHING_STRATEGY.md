# Branching Strategy

## Scope

This specification governs how branches are created, named, kept current, and merged in every repository. It applies to feature development, bug fixes, hotfixes, and release preparation. Adapt the variant (trunk-based vs. GitFlow) to your team's release cadence — the principles and guardrails are the same.

## Intent

A consistent branching model keeps the delivery trail auditable, reduces merge conflicts, and ensures that protected branches always represent a verified, deployable state.

## Variants

| Variant | Best for |
| --- | --- |
| Trunk-based | Teams shipping continuously; single default branch, short-lived feature branches (< 2 days) |
| GitFlow | Teams with scheduled releases; `main`, `develop`, `release/*`, `hotfix/*` branches |

Choose one variant and record it here. Mixed models create confusion and should be resolved by a reviewed update to this spec.

**Selected variant:** <!-- trunk-based | gitflow -->

## Branch Naming

| Type | Pattern | Example |
| --- | --- | --- |
| Feature | `feat/<ticket-id>-short-slug` | `feat/PROJ-42-user-auth` |
| Bug fix | `fix/<ticket-id>-short-slug` | `fix/PROJ-99-null-pointer` |
| Hotfix | `hotfix/<ticket-id>-short-slug` | `hotfix/PROJ-120-prod-crash` |
| Release | `release/<version>` | `release/2.4.0` |
| Chore | `chore/<short-slug>` | `chore/upgrade-deps` |

Branch names must be lowercase, hyphen-separated, and under 60 characters. Ticket IDs must match an approved ticket in the issue tracker.

## Protected Branches

The following branches are protected and accept changes only through pull requests with required approvals:

- `main` (or `master`) — always deployable
- `develop` — integration branch (GitFlow only)
- `release/*` — release candidates (GitFlow only)

Direct commits to protected branches are prohibited, including from CI bots and agent automation.

## Merge Policy

| Rule | Requirement |
| --- | --- |
| Squash merge | Feature and fix branches are squash-merged with a single descriptive commit message |
| Merge commit | Release branches are merged with a merge commit to preserve history |
| Linear history | The default branch maintains a linear history; rebase before squash-merge |
| Stale branches | Branches merged or inactive for more than <!-- 30 --> days are deleted |

## Hotfix Flow

1. Cut from `main` (not `develop`).
2. Apply the minimal fix with a linked ticket.
3. Merge to `main` through a fast-track PR with at least one approval.
4. Backport to `develop` immediately.
5. Tag a patch release.

## Acceptance Evidence

- Branch names match the pattern in CI (lint check or pre-receive hook).
- PRs to protected branches require at least the configured approval count.
- No direct pushes to protected branches appear in the audit log.
- Stale-branch deletion runs on the configured schedule.

## Token Budget Class

Workflow rule. Load for branching, PR, and release tasks.

## Related Specs

- `CODE_REVIEW.md` — PR review expectations and approval requirements.
- `RELEASE_PROCESS.md` — release tagging and promotion gates.
- `CHANGE_MANAGEMENT.md` — production change approval and freeze windows.

## AI Agent Directives

Always cut branches from the designated source. Name branches according to the pattern in this spec. Never push directly to a protected branch. Keep branches short-lived and scoped to a single ticket. Escalate to a human if a merge conflict cannot be resolved cleanly.
