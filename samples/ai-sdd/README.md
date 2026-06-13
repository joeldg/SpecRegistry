# AI-SDD Sample Spec Pack

A ready-to-load set of sample specifications that demonstrate SpecRegistry with realistic
content, derived from a **Spec-Driven Development (AI-SDD)** engineering-enablement framework.
The premise of that framework is exactly SpecRegistry's premise: rather than letting AI agents
make ad-hoc code changes, an organization first defines machine-readable specifications, then
holds both humans and agents to them.

## What it contains

**Global process specifications** (org-wide, loaded onto the seeded `Global` project type):

| File | Covers |
| --- | --- |
| `AI_AGENT_OPERATING_RULES.md` | Rules of engagement: specification-first, ticket-bound, diff discipline, test evidence, human approval gate |
| `GIT_FLOW.md` | Branching, merge policy, review gates, release tagging, rollback |
| `CODE_DEVELOPMENT_STANDARDS.md` | Coding standards, architecture rules, reuse, maintainability |
| `DOCUMENTATION_STANDARDS.md` | Documentation quality, coverage, and update rules |
| `OBSERVABILITY_AND_TRACEABILITY.md` | Spec→code traceability, divergence scoring, agent telemetry |
| `TICKET_WORKFLOW.md` | Ticket formatting, quality, governance, human-in-the-loop gates |

**Technical contract specifications** (loaded onto a new `Embedded Systems Platform` project type):

| File | Covers |
| --- | --- |
| `SYSTEM.md` | System behavior, boundaries, interfaces, operating assumptions |
| `API.md` | REST/OpenAPI behavior and compatibility policy |
| `SNMP_MAP.md` | SNMP OID naming, versioning, validation |
| `UDP_MESSAGE_CONTRACT.md` | JSON-over-UDP message contracts and timing assumptions |
| `PROTOBUF_CONTRACT.md` | Protobuf ownership, versioning, synchronization |
| `APPLICATION_CONFIG.md` | Configuration inventory, secrets, environment mapping |
| `DATABASE_SCHEMA.md` | Data model, migration policy, retention, compliance |
| `TEST_STRATEGY.md` | Unit/contract/SIL/HIL tests and the hardware-readiness gate |

Every spec ends with an **AI Agent Directives** section — the guidance an agent reads (via the
MCP `get_specs` tool or `GET /api/v1/ai/specs/:projectType`) before acting.

## Loading it

Start the registry, then run the loader against it:

```sh
node samples/ai-sdd/load.mjs
# or: npm run sample:ai-sdd

# Point at a different server / authenticate:
SPECREG_SERVER=http://localhost:4000 SPECREG_TOKEN=sreg_... node samples/ai-sdd/load.mjs
```

The loader is **idempotent** — it creates the project type if absent and publishes each spec
as `1.0.0`, skipping anything already present. Re-running it is safe.

> The content here is generic by design (no organization, product, or personnel names). It is
> sample material for demonstrating the platform.
