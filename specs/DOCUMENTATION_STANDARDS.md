# Documentation Standards

## Scope

This specification governs repository README files, architecture and developer guides, API
and CLI documentation, deployment and operational procedures, troubleshooting guidance,
and user-facing documentation.

## Source of Truth

Governed specifications define required behavior. Documentation explains how to use,
develop, operate, and verify that behavior. When documentation and a current spec conflict,
report the conflict and correct the appropriate source through review rather than silently
choosing one.

## Accuracy and Coverage

1. Documentation reflects current code, configuration, APIs, schemas, commands, generated
   artifacts, and deployment behavior.
2. Critical build, test, authentication, deployment, troubleshooting, recovery, and
   rollback workflows are documented where they exist.
3. Stale, contradictory, duplicated, and misleading content is corrected or explicitly
   retired.
4. Examples use supported commands and configuration names and do not expose secrets.
5. Instructions identify prerequisites and distinguish required behavior from optional
   recommendations.

## Change Rules

Update documentation in the same pull request when a public interface, command,
configuration option, schema contract, deployment procedure, or governed workflow changes.
Internal refactors require a documentation change only when they invalidate existing
guidance.

## Review

Documentation changes use the repository's normal pull-request review. Governed spec
changes additionally use SpecRegistry review and versioning. A repository may maintain
document owners, templates, or review gates, but those are required only when the
repository actually defines them.

## Acceptance Evidence

- Commands and examples are verified against the current repository where practical.
- Public behavior changes include the corresponding documentation diff.
- Broken or missing guidance is tracked as feedback or follow-up work.

## AI Agent Directives

Do not preserve known-false documentation for compatibility. When changing a documented
surface, update the relevant guide in the same change and report any unresolved
specification conflict.
