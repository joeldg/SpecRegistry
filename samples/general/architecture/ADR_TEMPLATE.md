# Architecture Decision Record Template

## Scope

This is a template for Architecture Decision Records (ADRs). Create one ADR per significant architectural decision. Store ADRs in `docs/decisions/` or an equivalent governed location. Once a decision is finalized, submit the ADR through the spec review workflow so it becomes a versioned governed artifact.

## Intent

ADRs prevent decisions from being silently revisited or forgotten. They record not just what was decided but why — including the options that were rejected. A future engineer (or agent) reading the codebase should be able to understand the reasoning behind every non-obvious structural choice.

---

## ADR-<!-- NNN -->: <!-- Title of the decision -->

**Status:** <!-- Proposed | Accepted | Deprecated | Superseded by ADR-NNN -->

**Date:** <!-- YYYY-MM-DD -->

**Deciders:** <!-- Names or roles of the people who made this decision -->

**Supersedes:** <!-- ADR-NNN, or "none" -->

---

## Context

<!-- Describe the situation that forced this decision. What problem were you trying to solve? What constraints existed (technical, organizational, timeline)? What would happen if no decision was made? Be specific. -->

## Options Considered

### Option 1: <!-- Name -->

<!-- Brief description. -->

**Pros:**
- <!-- ... -->

**Cons:**
- <!-- ... -->

### Option 2: <!-- Name -->

<!-- Brief description. -->

**Pros:**
- <!-- ... -->

**Cons:**
- <!-- ... -->

### Option 3: <!-- Name (if applicable) -->

<!-- Brief description. -->

**Pros:**
- <!-- ... -->

**Cons:**
- <!-- ... -->

## Decision

**We chose Option <!-- N -->.**

<!-- State the decision clearly and briefly. Then explain the primary reason — what tipped the balance? Reference any external constraints (performance requirement, cost ceiling, skill availability) that made this the right choice now even if it is not perfect long-term. -->

## Consequences

**Positive:**
- <!-- What does this decision enable or improve? -->

**Negative / trade-offs:**
- <!-- What does this decision make harder, more expensive, or more fragile? -->

**Risks:**
- <!-- What could go wrong and how will you know? -->

## Review Date

This decision should be revisited if <!-- describe the condition: e.g., traffic exceeds X req/s, the vendor drops support, a better alternative matures -->.

Next scheduled review: <!-- YYYY-MM-DD or "on trigger only" -->

---

## Token Budget Class

Reference detail. Load individual ADRs on demand by searching for the decision topic or ADR number.

## Related Specs

- `SERVICE_BOUNDARIES.md` — boundary decisions that may be governed by ADRs.
- `DEPENDENCY_POLICY.md` — ADRs that justify dependency choices.
- `DATA_MODEL.md` — ADRs that affect the data model or schema.

## AI Agent Directives

Before proposing a significant architectural change, search for existing ADRs on the topic. If a relevant ADR exists and is Accepted, follow it or submit a new ADR to supersede it — do not silently deviate. When drafting an ADR, complete every section; an ADR with empty consequence or risk sections is not ready for review.
