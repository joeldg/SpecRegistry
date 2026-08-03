# Git Flow

## Scope

This specification defines the minimum governed branch, pull-request, verification, merge,
and rollback flow. A repository may document stricter naming and protection rules.

## Branches

1. Start work from the current default branch unless a reviewed release or hotfix process
   specifies another base.
2. Use the repository's configured branch prefix and naming convention. Agent-created
   branches use the host-required prefix, such as `codex/`, when one is configured.
3. Keep a branch focused on one reviewable objective. A ticket may be linked when the work
   originates from an issue tracker, but a ticket is not required when an authorized user
   request or governed task session is the source of work.
4. Do not push implementation commits directly to a protected default or release branch.

## Pull Requests

- Changes reach protected branches through pull requests.
- Open a ready PR when the change is complete and verified; use draft status only while
  work is intentionally incomplete or awaiting a blocking decision.
- The PR describes the objective, affected specs or exact sections, verification actually
  run, skipped or failed checks, compatibility risk, and residual work.
- Required repository checks and human approvals control merge eligibility.
- Agents may prepare and update PRs but do not approve or merge their own governed changes.

## Merge and History

Use the merge method allowed by repository settings and maintainers. Do not claim that
rebase, squash, or merge commits are universally required when the repository does not
enforce that policy. Keep commits and PR scope coherent enough to review and revert.

## Releases

When a repository publishes versioned releases, follow its release specification and
Semantic Versioning policy. Release notes link the change and available validation evidence.

## Rollback

Every merged change should be recoverable through a reviewed revert, compensating migration,
feature disablement, or documented operational rollback. High-risk changes state the
rollback path before merge. A rollback is itself recorded and reviewed.

## AI Agent Directives

Create a scoped branch from the current base, open a truthful PR, and leave approval and
merge to authorized humans. Do not invent a ticket, approval, check result, merge policy,
or release requirement.
