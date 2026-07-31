# Code Development Specification

## Purpose

Defines coding standards, architecture rules, reuse principles, and implementation
expectations that apply across software and firmware. Without explicit development rules,
an AI agent can make changes that are technically correct but architecturally wrong —
diverging from subsystem boundaries, duplicating logic, or introducing fragile patterns.

## Coding Standards

- Prefer clarity over cleverness; code is read far more often than it is written.
- Match the conventions, naming, and idioms of the surrounding code.
- Every public interface requires documentation that evolves with the code.
- No dead code, commented-out blocks, or speculative abstractions left behind.

## Architecture Rules

| Rule | Requirement |
| --- | --- |
| Subsystem boundaries | Code stays within its declared subsystem; cross-boundary calls go through defined interfaces only. |
| No architectural drift | Implementation must not diverge from the design intent recorded in the System and Subsystem specifications. |
| Dependency direction | Dependencies flow inward toward domain logic; outer layers depend on inner, never the reverse. |
| Configuration over hardcoding | Behavior that varies by environment is driven by configuration, not literals (see the Application Configuration specification). |

## Reuse Principles

1. Before adding logic, search for an existing implementation that already does it.
2. Duplicated logic is a defect; extract and reuse rather than copy.
3. Shared utilities live in their owning subsystem with a documented interface.

## Maintainability & Testability

- Functions and modules must be small enough to unit test in isolation.
- Avoid hidden global state; make inputs and effects explicit so behavior is simulatable.
- Flag overly complex or fragile areas for refactor rather than building on top of them.

## Compliance Checks

Static analysis enforces naming, structure, security risk, and these development rules.
A change that fails static analysis is not eligible for review.

## AI Agent Directives

When an agent identifies redundant logic, architectural drift, or an opportunity for reuse
while implementing a ticket, it must surface that finding in the PR rather than silently
extending the problem. Agents must compare their changes against the expected subsystem
boundaries before proposing them.
