---
name: resolve-task
description: "Open or locate the governing task (GitHub Issue or .tasks/ file) before non-trivial implementation work. Record the task reference in branch, commits, and PR."
metadata:
  specregistry_id: 71220eb5-85f0-4362-84fe-cb2f0705d2e5
  risk_level: safe
  source_candidate_id: 
  source_url: 
  source_path: 
  source_commit: 
  upstream_content_hash: 
---

# resolve-task

Open or locate the governing task (GitHub Issue or .tasks/ file) before non-trivial implementation work. Record the task reference in branch, commits, and PR.

## Instructions

# Resolve a task before implementation

Before non-trivial work, open or locate the correct task in the project's system of record.

## Instructions

1. **Detect the task system.** Read `.git/config` and check whether the `origin` remote
   URL contains `github.com`. If yes, use the GitHub Issues path. Otherwise use the local
   `.tasks/` path.

2. **GitHub-backed project:**
   - Check whether `SPECREG_GITHUB_TOKEN` or `GITHUB_TOKEN` is set.
   - If a relevant open issue already exists (search by title or provided issue number),
     load it and record the number as `Task-Ref: #<number>`.
   - If no issue exists, run:
     ```
     specreg task open --title "<title>" [--spec-refs "SPEC.md#section,..."]
     ```
     Record the returned issue number.
   - If the token is absent, fall back to the local `.tasks/` path and note
     `github_fallback: true` in the created task file.

3. **Local `.tasks/` project:**
   - If a matching task file already exists, load it.
   - If not, run:
     ```
     specreg task open --title "<title>" [--spec-refs "SPEC.md#section,..."]
     ```
     Record the returned filename as `Task-Ref: .tasks/<filename>`.

4. **Use the task reference everywhere:**
   - Name the working branch: `task/<id-or-issue>-<short-slug>`
   - Include `Task-Ref:` in every implementation commit trailer.
   - Include the task reference in the PR body: `Closes #<number>` or
     `Task-Ref: .tasks/<filename>`.

5. **Pass the task reference to `begin_task`** as the `task_ref` field when opening
   a governed session.

6. **Update task status** as work progresses:
   - Set to `in-progress` when implementation begins.
   - Set to `blocked` with a `blocked_by` note when halting for human input.
   - Let `finish_task` / merge close or mark `done` — do not close prematurely.

## Safety Boundary

This skill is a governed operating procedure, not permission to take external or destructive
actions. Follow the agent host's approval policy, current published specifications, and the
principle of least privilege. Stop and ask when required authorization or intent is unclear.
Creating a GitHub Issue or a `.tasks/` file is the only external write permitted by this skill.

## Safety Boundary

This skill is a governed operating procedure, not permission to take external or destructive
actions. Follow the agent host's approval policy, current published specifications, and the
principle of least privilege. Stop and ask when required authorization or intent is unclear.
