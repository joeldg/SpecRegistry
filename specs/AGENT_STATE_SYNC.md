# Cross-Workspace Agent State Coordination

## Scope

This specification governs how SpecRegistry coordinates unpublished specification changes made in multiple local workspaces for the same repository. It covers the `specreg state` CLI workflow, registry persistence, conflict reporting, and recovery snapshots.

## Intent

An agent working on one computer must be able to discover spec edits reported from another computer before it unknowingly creates a conflicting implementation or spec proposal. Coordination metadata must not become a second source of truth or bypass spec review.

## Requirements

1. Each local workspace must have an opaque, stable workspace identifier that does not expose a hostname or other private machine identifier.
2. A workspace state report must identify the repository, project type, agent, Git branch and commit, governed manifest hash, and every locally added, modified, or deleted Markdown spec.
3. Spec changes must be compared to the content hashes in the current governed manifest, not inferred only from Git working-tree status.
4. The registry must retain the latest state for each project and workspace and must authorize agent writes against the agent token's bound repository and project type.
5. State reports may contain recoverable Markdown spec snapshots, but must not contain arbitrary source-code content, credentials, or secrets.
6. Uploading agent state must not create, edit, review, approve, or publish a governed specification.
7. State checks must distinguish an incoming change from a conflict when both the local and peer workspace changed the same governed spec from the recorded base.
8. Pulling peer state must write snapshots outside the governed `specs/` directory and must never overwrite governed files.
9. The dashboard may flag spec sections with no links in the latest code trace as potentially unused, but must distinguish missing trace data from an actual unlinked result and must not describe absence of a link as proof that normative guidance should be deleted.
10. State payloads and individual snapshots must have explicit size and count limits.

## Non-Goals

- Agent state is not a distributed lock, Git replacement, merge engine, or spec publication channel.
- SpecRegistry does not automatically apply a peer's edits to governed files.
- A section without code evidence is not automatically obsolete; process, security, and governance sections may be normative without a direct code entity.

## Acceptance Evidence

- Server tests demonstrate create, update, list, authorization scope, and unsafe-path rejection for workspace state.
- CLI tests demonstrate hash-based local change detection and recovery of a peer snapshot under `.spec/incoming/` without changing `specs/`.
- `specreg state push`, `check`, `pull`, and `sync` document their effect and preserve governance boundaries.
- The project dashboard shows section evidence only when a trace report exists and labels unlinked sections as review signals.
- Database migration is append-only and agent-state updates are audit logged.

## Token Budget Class

Project workflow rule. Load when coordinating concurrent agent work, editing specs, resolving cross-workspace drift, or changing agent-state APIs.

## Related Specs

- `DESIGN.md`
- `STRUCTURE.md`
- `SPEC_GOVERNANCE.md`
- `SPEC_SECTION_EVIDENCE.md`
- `GLOBAL_SECURITY.md`

## AI Agent Directives

Run `specreg state sync` before spec-changing work when the repository may be active on another computer. Review incoming snapshots and resolve conflicts deliberately. Never copy a peer snapshot over a governed spec or publish it without the normal review workflow.
