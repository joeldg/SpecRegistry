# Onboarding Checklist

## Scope

This specification is a template for new engineer onboarding. Adapt it for your team's tools, systems, and culture. Publish the adapted version as a governed spec so it stays current as the stack evolves.

## Intent

A complete, up-to-date onboarding checklist lets new engineers become productive quickly without depending on a single person to walk them through setup. It also reveals gaps in documentation — if something is not in this checklist, a new engineer will have to ask, which means it should be added.

---

## Before Day One (Hiring Manager / HR)

- [ ] Accounts created: email, GitHub org, Slack, issue tracker, cloud provider console
- [ ] Hardware ordered and ready
- [ ] Buddy / mentor assigned
- [ ] First-week calendar blocked: onboarding meetings, 1:1s, team standup
- [ ] Welcome message sent with first-day logistics

## Day One

### Access

- [ ] GitHub organization membership confirmed; can clone repositories
- [ ] Slack workspace joined; added to team and project channels
- [ ] Issue tracker access confirmed (<!-- Jira / Linear / GitHub Issues -->)
- [ ] Cloud console access (read-only to start): <!-- AWS / GCP / Azure -->
- [ ] VPN set up and connected
- [ ] Password manager set up and company secrets vault access granted

### Environment Setup

- [ ] Development machine set up per `<!-- docs/DEV_SETUP.md -->`
- [ ] Clone the main repository and verify build passes: `<!-- npm run build -->`
- [ ] Run the test suite: `<!-- npm test -->` — all tests pass
- [ ] Run the local development server: `<!-- npm run dev -->` — app loads in browser
- [ ] Install required IDE extensions: `<!-- list -->`

### Introductions

- [ ] Met buddy / mentor
- [ ] Attended team standup
- [ ] Introduced in the team Slack channel

## Week One

### Codebase Orientation

- [ ] Read `<!-- README.md -->` — understand what the product does and how to run it
- [ ] Read `<!-- docs/ARCHITECTURE.md or DESIGN.md -->` — understand the system structure
- [ ] Read `<!-- BRANCHING_STRATEGY.md -->` — understand how to create branches and submit PRs
- [ ] Read `<!-- CODE_REVIEW.md -->` — understand what reviewers expect
- [ ] Pair with buddy on a small first ticket (labeled `<!-- good first issue / onboarding -->`)

### Governance and Process

- [ ] Read this team's governing specifications (ask buddy for the link to the spec registry)
- [ ] Read `<!-- INCIDENT_RESPONSE.md -->` — understand what to do if something breaks
- [ ] Read `<!-- SECRETS_MANAGEMENT.md -->` — understand how to handle credentials
- [ ] Read `<!-- LLM_USAGE_POLICY.md -->` — understand how AI tools may be used

### First PR

- [ ] Submit a PR for the first ticket
- [ ] PR reviewed and merged
- [ ] Deploy confirmed if applicable

## Week Two and Beyond

- [ ] Joined the on-call rotation (with shadow period first): `<!-- after N weeks -->`
- [ ] Assigned a meaningful feature ticket
- [ ] 1:1 with tech lead: architectural overview and career development goals
- [ ] 30-day check-in with manager: what's working, what's confusing, what to improve in this checklist

## Buddy Responsibilities

The buddy's job is to:
- Be the first point of contact for any question, no matter how basic
- Pair on at least one session per day for the first week
- Review the new engineer's first PR and give constructive, thorough feedback
- Update this checklist if any step is missing, outdated, or unclear

## Acceptance Evidence

- New engineers complete all Day One and Week One items within the defined timeline.
- Onboarding checklist is reviewed by the team at least quarterly.
- Gaps identified by new engineers are added to this checklist within one week.

## Token Budget Class

Reference detail. Load on demand for onboarding tasks.

## Related Specs

- `CODE_REVIEW.md` — what reviewers expect; essential reading in Week One.
- `BRANCHING_STRATEGY.md` — how to create branches and submit PRs.
- `SECRETS_MANAGEMENT.md` — credential handling; required reading before any access is granted.

## AI Agent Directives

This is a template. Fill in every `<!-- placeholder -->` with your team's actual tools, links, and timelines before publishing. When helping a new engineer through onboarding, work through the checklist sequentially — do not skip steps. If a step references a document that does not exist, flag it as a gap and create a ticket to produce that documentation.
