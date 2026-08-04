# Agent Containment

## Scope

This specification defines the blast-radius limits for autonomous AI agents: allowed file paths, forbidden shell commands, network access scope, human approval gates, and retry limits before escalation. It applies to every automated agent that reads, writes, or executes code in this organization's repositories or infrastructure.

## Intent

An autonomous agent that can do anything is an autonomous agent that can break anything. Containment defines the smallest set of capabilities an agent needs to do useful work, so that mistakes, misunderstood instructions, and adversarial inputs have a bounded impact.

## Allowed Operations

Agents may perform the following operations autonomously without human approval:

| Operation | Scope | Notes |
| --- | --- | --- |
| Read files | Repository working directory | No access to parent directories or other repos |
| Write files | Working directory, non-protected paths | See Forbidden Paths |
| Run tests | `npm test` / `pytest` / equivalent | Read-only against local state |
| Run linters and formatters | Standard project tooling | No network access required |
| Search and read documentation | Local files and approved internal APIs | |
| Create branches and commits | In the working repository only | Cannot push to protected branches |
| Call approved external APIs | Listed in the Approved External Calls table | With rate limits and logging |

## Forbidden Paths

Agents must not read or write the following paths without explicit human approval per operation:

- `<!-- /etc/ -->`, `<!-- /var/ -->`, `<!-- ~/.ssh/ -->`, `<!-- ~/.aws/ -->` — system and credential directories
- Any file matching `<!-- *.env, *.key, *.pem, *credentials* -->` — credential files
- Protected branch refs (`main`, `release/*`) — no direct push
- Outside the working repository root — no access to sibling repositories

## Forbidden Shell Commands

The following commands are unconditionally prohibited:

| Command | Reason |
| --- | --- |
| `rm -rf` / `del /f /s /q` | Irreversible bulk deletion |
| `git push --force` | Rewrites shared history |
| `git reset --hard` | Discards uncommitted work |
| `sudo` / privilege escalation | Bypasses OS-level containment |
| Any command that modifies system configuration | Outside repository scope |
| Network commands that exfiltrate data (`curl`, `wget` to unapproved endpoints) | Data leakage risk |

If a task seems to require a forbidden command, the agent must stop and ask for human instruction.

## Network Access

Agents may make network calls to:

| Destination | Allowed | Notes |
| --- | --- | --- |
| Approved external APIs (see table below) | Yes | Rate-limited; logged |
| Internal services via approved APIs | Yes | With authentication |
| Package registries (npm, PyPI, crates.io) | Yes | For dependency installation only |
| Arbitrary external URLs | No | Must be explicitly approved |

### Approved External Calls

| Service | Purpose | Auth method | Rate limit |
| --- | --- | --- | --- |
| <!-- SpecRegistry MCP server --> | Spec lookup, compliance | Bearer token | Per-repo quotas |
| <!-- GitHub API --> | PR creation, issue updates | Token from secret manager | GitHub default |
| <!-- Add rows --> | | | |

## Human Approval Gates

The following operations require explicit human approval before the agent proceeds:

- Merging a PR to a protected branch
- Deploying to any environment (staging or production)
- Publishing a specification change
- Deleting or permanently modifying data
- Calling an external service not in the Approved External Calls table
- Executing any command on a remote system

When an approval gate is reached, the agent must stop, present what it is about to do and why, and wait for a human to confirm.

## Retry Limits

| Scenario | Max retries | On limit |
| --- | --- | --- |
| Failing CI / lint check | <!-- 3 --> | Halt and present the error to the human |
| Spec compliance check failure | <!-- 3 --> | Halt and present the compliance gap |
| PR rejected by reviewer | <!-- 2 --> | Halt and flag for human-in-the-loop review |
| External API call failure | <!-- 3 --> with exponential backoff | Halt and report; do not loop indefinitely |

## Acceptance Evidence

- Agents do not access paths outside the working directory without explicit per-operation approval.
- Agents do not execute forbidden shell commands.
- Agents halt at approval gates and present a clear summary of the proposed action.
- Retry limits are enforced; agents do not loop indefinitely on failures.

## Token Budget Class

Global invariant. Load by default for every agent task; containment rules apply regardless of task type.

## Related Specs

- `LLM_USAGE_POLICY.md` — overall policy for AI tool usage and prohibited actions.
- `SECRETS_MANAGEMENT.md` — agents must not access or log credential files.
- `CHANGE_MANAGEMENT.md` — the human approval process that agents must defer to.
- `BRANCHING_STRATEGY.md` — branch and merge rules that agents must follow.

## AI Agent Directives

You are subject to these containment rules. Before executing any shell command, verify it is not on the forbidden list. Before accessing any file path, verify it is within the allowed scope. When you reach a human approval gate, stop completely and present your intended action — do not proceed without a human response. If you reach a retry limit, halt and surface the problem to the human rather than continuing to retry.
