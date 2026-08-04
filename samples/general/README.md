# General-Purpose Specification Library

A curated library of 35 ready-to-use specification templates covering the full breadth of software engineering governance. Every spec ships with an **AI Agent Directives** section so agents can use them immediately, and with `<!-- placeholder -->` markers for the values your team must supply.

These are starting points, not finished artifacts. Publish them into your SpecRegistry, then customize them through the normal draft/review/publish workflow.

## What It Contains

### Engineering Process (6 specs)

| File | Covers |
| --- | --- |
| `BRANCHING_STRATEGY.md` | Branch naming, protected branches, merge policy, hotfix flow |
| `CODE_REVIEW.md` | Reviewer responsibilities, approval requirements, turnaround SLAs |
| `RELEASE_PROCESS.md` | Versioning policy, release checklist, rollback triggers and procedure |
| `INCIDENT_RESPONSE.md` | Severity tiers, on-call roles, war room protocol, post-mortems |
| `ON_CALL_RUNBOOK.md` | Per-service runbook template: alerts, triage steps, rollback commands |
| `CHANGE_MANAGEMENT.md` | Risk classification, approval gates, freeze windows, post-change validation |

### Architecture (6 specs)

| File | Covers |
| --- | --- |
| `ADR_TEMPLATE.md` | Architecture Decision Record template with context, options, decision, consequences |
| `API_CONTRACT.md` | Versioning, error shapes, pagination, deprecation, backwards-compatibility rules |
| `EVENT_SCHEMA.md` | Envelope format, topic naming, schema versioning, consumer guarantees, dead-letter |
| `DATA_MODEL.md` | Entity definitions, ownership boundaries, ID conventions, migration policy |
| `SERVICE_BOUNDARIES.md` | What each service owns, allowed communication patterns, data duplication |
| `DEPENDENCY_POLICY.md` | Introduction criteria, license allowlist, version pinning, CVE SLAs |

### Security (6 specs)

| File | Covers |
| --- | --- |
| `AUTHENTICATION_FLOWS.md` | Supported mechanisms, token lifecycle, storage rules, revocation, security gate |
| `AUTHORIZATION_MODEL.md` | RBAC/ABAC model, permissions matrix, default-deny, resource scoping |
| `DATA_CLASSIFICATION.md` | Sensitivity tiers (Public/Internal/Confidential/Restricted), handling rules, disposal |
| `PRIVACY_AND_PII.md` | PII inventory, data minimization, consent model, subject rights, breach notification |
| `VULNERABILITY_MANAGEMENT.md` | CVE triage, severity-to-SLA, compensating controls, exception policy, disclosure |
| `SECRETS_MANAGEMENT.md` | Storage locations, prohibited patterns, rotation policy, emergency revocation |

### Testing (4 specs)

| File | Covers |
| --- | --- |
| `TEST_STRATEGY.md` | Test pyramid, coverage thresholds, what must be tested, CI enforcement |
| `ACCEPTANCE_CRITERIA_STANDARD.md` | Given/When/Then format, weak-vs-strong rubric, writing for agents |
| `LOAD_AND_PERFORMANCE.md` | Performance targets, load test triggers, regression detection, baseline management |
| `CHAOS_AND_RESILIENCE.md` | Failure scenario checklist, game day format, exercise log, acceptance criteria |

### Observability (5 specs)

| File | Covers |
| --- | --- |
| `LOGGING_STANDARD.md` | JSON log format, required fields, prohibited fields, retention, log-based alerts |
| `METRICS_AND_ALERTING.md` | RED/USE metrics, alert rules, on-call paging SLAs, required alert conditions |
| `DISTRIBUTED_TRACING.md` | W3C TraceContext propagation, required span attributes, sampling policy |
| `SLO_POLICY.md` | SLI/SLO/error budget definitions, error budget policy, burn-rate alerts, review cadence |
| `DEPLOYMENT_RUNBOOK.md` | Pre-flight checklist, deploy steps, smoke tests, rollback triggers, observation window |

### AI Governance (4 specs)

| File | Covers |
| --- | --- |
| `LLM_USAGE_POLICY.md` | Permitted uses, uses requiring review, prohibited uses, attribution |
| `PROMPT_GOVERNANCE.md` | Prompt versioning, review requirements, injection mitigations, output validation |
| `AI_DATA_HANDLING.md` | Classification-based rules, approved providers, data minimization, audit requirements |
| `AGENT_CONTAINMENT.md` | Allowed operations, forbidden paths/commands, network access, approval gates, retry limits |

### Team (4 specs)

| File | Covers |
| --- | --- |
| `ONBOARDING_CHECKLIST.md` | Day one setup, week one codebase orientation, first PR, buddy responsibilities |
| `DECISION_LOG.md` | Lightweight format for team-level decisions (vs. full ADRs) |
| `MEETING_CADENCE.md` | Standup, sprint planning, retro, architecture review, on-call handoff, 1:1s |
| `ESCALATION_PATH.md` | Who to contact for technical, security, compliance, and personnel issues |

## Loading It

Start the registry, then run the loader:

```sh
node samples/general/load.mjs
# or: npm run sample:general

# Authenticate when the server requires it:
SPECREG_SERVER=http://localhost:4000 SPECREG_TOKEN=sreg_... node samples/general/load.mjs
```

The loader is **idempotent** — it creates each project type if absent and publishes each spec as `1.0.0`, skipping anything already present.

## Customizing Your Specs

Every spec contains `<!-- placeholder -->` markers for values specific to your team:

- Time thresholds (`<!-- 30 days -->`, `<!-- 15 minutes -->`)
- Tool names (`<!-- k6 -->`, `<!-- Linear -->`, `<!-- PagerDuty -->`)
- Contact names and handles
- Service-specific details

After loading, open each spec in the SpecRegistry UI, create a change request, replace the placeholders with your team's values, and publish. The review history becomes your record of governance decisions.

## Spec Philosophy

These specs follow the SpecRegistry authoring standard:

- **Specific section headings** — each section is retrievable by `search_specs` without loading the full document.
- **AI Agent Directives** — every spec tells agents exactly what to do and what to stop and escalate.
- **Token budget class** — every spec declares whether it should be always-loaded or searched on demand.
- **Related Specs** — every spec cross-references the other specs it depends on.
- **Placeholder values** — thresholds and contacts are clearly marked for customization, not baked in as if they were universal truths.
