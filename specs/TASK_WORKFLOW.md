# Task Workflow

## Scope

This specification applies globally to every repository and project governed by SpecRegistry.
It defines how AI agents and developers open, track, reference, and close work items before
and during implementation. It supersedes any ambiguous guidance in TICKET_WORKFLOW.md for
task lifecycle and location.

## Intent

Every non-trivial change must be traceable to an open task. The task is the authoritative
record of intent, scope, acceptance criteria, and outcome.

**GitHub Issues are the mandatory system of record for tasks.** Every governed task MUST be
tracked as a GitHub Issue. The local `.tasks/` folder is NOT a normal alternative; it exists
only as a temporary emergency fallback when the GitHub Issues API is genuinely unreachable
(see **Emergency Local Fallback**). A local task file is always provisional and MUST be
migrated to a GitHub Issue as soon as the API is reachable again.

Projects governed by SpecRegistry are expected to be GitHub-backed. A repository with no
GitHub `origin` remote cannot satisfy this workflow; the agent MUST halt and escalate to a
human rather than silently tracking work outside GitHub Issues.

## Task System Detection

Before opening or referencing a task, an agent must confirm that GitHub Issues are usable:

1. Read `.git/config` and extract the `url` for the `origin` remote.
2. If the URL contains `github.com`, the project is **GitHub-backed** and the agent MUST use
   the GitHub Issues task path.
3. If the URL does not contain `github.com`, or no git remote is configured, the project
   cannot satisfy this workflow. The agent MUST halt and escalate to a human. It MUST NOT
   silently create local task files as a substitute for GitHub Issues.
4. A GitHub credential is required: `SPECREG_GITHUB_TOKEN` or `GITHUB_TOKEN`. If no token is
   configured, this is an error, not a reason to fall back. The agent MUST halt and report
   that a GitHub token is required, rather than writing a local task file.
5. The only permitted use of the local `.tasks/` path is a genuine GitHub Issues API outage
   while a valid token is present — see **Emergency Local Fallback**.

## GitHub Issues Task Path

### Opening a Task

When no existing issue covers the current work:

1. Create a GitHub Issue via the GitHub REST API (`POST /repos/{owner}/{repo}/issues`).
2. Use the standard issue body template (see **Task Content** below).
3. Record the issue number as the canonical task reference: `#<number>`.
4. Add the label `specreg-task` to the issue for filter visibility.

When an issue already exists and its state is `open`:

1. Confirm the issue's title and acceptance criteria match the intended work.
2. Use the existing issue number as the task reference.
3. Add a comment via the API recording the session, model, and governed spec set loaded.

### Branch and Commit Naming

- Branch: `task/<issue-number>-<short-slug>`  (e.g. `task/42-add-rate-limiting`)
- Commit trailer: `Task-Ref: #<issue-number>`

### Closing a Task

1. When the PR is merged, close the linked issue via the GitHub API or by including
   `Closes #<number>` in the PR body.
2. If merge is rejected, leave the issue open and add a comment explaining the outcome.

## Emergency Local Fallback

The local `.tasks/` path is permitted ONLY when a valid GitHub token is present but the
GitHub Issues API is genuinely unreachable (network outage, GitHub incident, or rate-limit
lockout). It is never a first-class alternative to GitHub Issues.

When the fallback is used the agent MUST:

1. Set `github_fallback: true` in the task front-matter.
2. Record in the **Notes** section the reason the API was unreachable and the timestamp.
3. Treat the local task as provisional. Before opening a PR, the agent MUST migrate the task
   to a real GitHub Issue: create the Issue, copy the content, set the local file `status`
   to `abandoned` with a Note pointing to the new `#<number>`, and use the Issue number as
   the canonical task reference from that point on.
4. Never mark a fallback task `done` locally. Completion is recorded only on the GitHub Issue.

### Folder Layout

```
.tasks/
  .gitignore          ← do NOT gitignore — tasks are team artifacts
  0001-<slug>.md
  0002-<slug>.md
  ...
```

Task files are committed to git. They are team-visible artifacts, equivalent to GitHub Issues.

### File Naming

`<id>-<slug>.md` where:
- `id` is a zero-padded four-digit integer, incrementing from the highest existing id.
- `slug` is a kebab-case summary of the task title, max 40 characters.

Example: `0003-add-oauth-middleware.md`

### Task File Schema

Every task file must begin with a YAML front-matter block followed by a Markdown body:

```markdown
---
id: "0003"
title: "Add OAuth middleware"
status: open
created: 2025-08-11
updated: 2025-08-11
spec_refs:
  - GLOBAL_SECURITY.md#authentication
  - API.md#auth-endpoints
branch: task/0003-add-oauth-middleware
pr: null
blocked_by: null
github_fallback: false
---

## Objective

One paragraph describing what must be true when this task is done and why it matters.

## Acceptance Criteria

- [ ] Criterion one
- [ ] Criterion two

## Affected Systems

List repositories, subsystems, APIs, schemas, or config areas in scope.

## Spec References

Enumerate the governed spec filenames and sections that govern this work.

## Assumptions and Open Questions

Document any assumption the agent made. If a required decision would materially
change the result, record it here and halt until resolved.

## Notes

Progress notes, blockers, and residual risks appended chronologically.
```

### Status Values

| Status | Meaning |
|---|---|
| `open` | Created, not started |
| `in-progress` | Active implementation underway |
| `blocked` | Cannot proceed; blocked_by is set |
| `done` | Accepted and merged |
| `abandoned` | Closed without completion; reason recorded in Notes |

### Branch and Commit Naming

- Branch: `task/<id>-<slug>`  (e.g. `task/0003-add-oauth-middleware`)
- Commit trailer: `Task-Ref: .tasks/0003-add-oauth-middleware.md`

### Updating a Task File

Agents must update the `status` and `updated` fields whenever the task state changes.
Append timestamped notes to the **Notes** section rather than overwriting earlier entries.

## Task Content Requirements

All tasks — GitHub Issues and local files — must record:

- The desired outcome and why it matters.
- Affected repository, subsystem, API, schema, configuration, or operational area.
- Applicable governed spec filenames and sections.
- Acceptance criteria sufficient to verify completion.
- Compatibility and risk considerations proportional to the change size.
- Assumptions and unresolved questions.

The depth of each field is proportional to risk and ambiguity. Small, low-risk changes
require minimal ceremony; high-risk or breaking changes require explicit acceptance criteria,
rollback expectations, and migration notes.

## Relationship to `begin_task` / `finish_task`

The task reference (GitHub Issue number or `.tasks/` file path) must be provided to
`begin_task` as the `task_ref` field. The governed session links to the task, not the
other way around. `finish_task` must update the task status to `done` (GitHub: close the
issue; local: set `status: done` and commit).

## Relationship to Pull Requests

Every PR body must include the task reference:

- GitHub: `Closes #<number>` or `Task-Ref: #<number>` if not auto-closing.
- Local: `Task-Ref: .tasks/<filename>`.

The PR remains responsible for describing the diff, spec mapping, verification outcomes,
and residual risk. A task reference does not replace that evidence.

## Agent Directives

1. Before non-trivial work, open or locate a GitHub Issue for the task. GitHub Issues are
   mandatory. Do not proceed without a GitHub Issue task reference.
2. Do not fall back to a local `.tasks/` file because a token is missing or the repository is
   not GitHub-backed. In those cases, halt and escalate to a human. The local path is only
   for a genuine API outage while a valid token is present.
3. If the emergency local fallback is used, migrate the task to a GitHub Issue before opening
   a PR, and use the Issue number as the canonical reference thereafter.
4. Do not invent task IDs or issue numbers. The ID comes from the GitHub API response, or —
   for a fallback file only — the next integer after the highest existing `.tasks/` file id.
5. Do not mark a task `done` or close a GitHub Issue until the PR is merged or the work is
   explicitly abandoned by a human decision.
6. When blocked or when required guidance is missing, set status to `blocked`, record the
   blocker in the task, and halt until resolved.
7. Always include `Task-Ref` in branch names, commit trailers, and PR bodies.
8. Run `specreg task status` to verify task state before declaring work complete.

## Acceptance Evidence

- Every governed task is tracked as a GitHub Issue carrying the `specreg-task` label.
- Every implementation branch name contains the GitHub Issue number.
- Every implementation commit includes a `Task-Ref: #<number>` trailer.
- Every PR body contains the GitHub Issue reference (`Closes #<number>` or `Task-Ref: #<number>`).
- No governed work is completed against a local `.tasks/` file; any fallback file was migrated
  to a GitHub Issue before the PR was opened.
- `specreg task list --status open` shows only genuinely open work.

## Token Budget Class

Global invariant. Load by default for agents; it defines when and how task references
are opened and maintained.

## Related Specs

- `AI_AGENT_OPERATING_RULES.md`
- `TICKET_WORKFLOW.md`
- `GIT_FLOW.md`
- `IMPLEMENTATION_EVIDENCE.md`
- `SDD_OPERATING_MODEL.md`
