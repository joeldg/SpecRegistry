# Developer Guide

## Project Quickstart

Use this flow when bringing SpecRegistry into a new or existing repository.

1. **Build and link the CLI.**
   From the SpecRegistry checkout, install dependencies, build the workspace, and link the
   local `specreg` binary onto your PATH. The CLI also exposes the MCP stdio server via
   `specreg mcp`, which is what generated `.mcp.json` files use:

   ```sh
   cd /path/to/SDDManager
   npm install
   npm run build
   npm link -w @specregistry/cli
   ```

   If you do not want to link the binaries, use
   `node /path/to/SDDManager/packages/cli/dist/index.js ...` anywhere this quickstart shows
   `specreg ...`.

2. **Choose the initialization path.**
   For a brand-new project, run the guided walkthrough. It records the intended product
   shape, languages, frameworks, platforms, databases, interfaces, servers/runtimes,
   infrastructure, identity, messaging, observability, testing, delivery, security,
   environments, constraints, and non-goals. For an existing standardized project, pass
   `--type` to use a premade project type directly.

3. **Initialize the repository.**
   From the project root, pull the approved spec bundle, write the local manifest, create
   MCP config, and optionally install suggested Google style guides:

   ```sh
   cd /path/to/app
   # New project: guided setup is the default
   specreg init --server http://localhost:4000

   # Existing/premade baseline: skip the walkthrough
   specreg init --server http://localhost:4000 --type "Acme Edge Device"
   ```

4. **Generate or edit repo-specific draft specs.**
   For an existing codebase, let the CLI scan the project and create draft material under
   `.spec/drafts/`. For a new project, write the specs you want to submit there directly.

   ```sh
   specreg generate --write --examples --server http://localhost:4000 --type "Acme Edge Device"
   ```

   `--examples` writes companion files like `.spec/examples/DESIGN.examples.md` with
   positive examples, anti-examples, edge cases, and review notes for the generated draft.

5. **Submit drafts to the registry.**
   This creates project-scoped drafts or review requests so they can become governed specs.
   Use `--publish` for newly-created drafts you want to publish immediately, and `--force`
   when you intentionally want to resubmit/overwrite local generated draft material.

   ```sh
   specreg submit-drafts --server http://localhost:4000 --type "Acme Edge Device" --publish --force
   ```

6. **Approve and publish reviews in the dashboard.**
   Open [http://localhost:5173/reviews](http://localhost:5173/reviews), inspect diffs,
   compatibility reports, lint findings, and risk notes, then approve/publish the reviews
   that should become governed source of truth.

7. **Pull the approved versions locally.**
   After the registry publishes the specs, sync the local `specs/` directory and manifest.

   ```sh
   specreg sync --server http://localhost:4000
   ```

8. **Compile agent context.**
   Rebuild `CLAUDE.md`, `AGENTS.md`, or `.cursorrules` from the approved local spec set.
   `specreg sync` also auto-compiles targets that were previously remembered.

   ```sh
   specreg compile --server http://localhost:4000 --target claude
   ```

## Developer CLI

Build the workspace before using the CLI. During local development, link the CLI onto your
PATH; `specreg mcp` runs the MCP stdio server:

```sh
npm install
npm run build
npm link -w @specregistry/cli
```

If you do not want to link the bins, run the built CLI directly from this checkout:

```sh
node packages/cli/dist/index.js --help
```

The dashboard/downloaded CLI package records the registry URL it was downloaded from, so
`specreg init` can reach that registry without a `--server` flag. Source-checkout and linked
CLI installs should use `--server` or `SPECREG_SERVER`.

Initialize a new repository after the CLI is built and either linked or called through
`node packages/cli/dist/index.js`:

```sh
cd /path/to/app
specreg init --server http://localhost:4000
```

Interactive `specreg init` defaults to a comprehensive new-project walkthrough. Each
multi-choice step accepts comma-separated numbers, option names, or arbitrary custom text.
The walkthrough covers:

- project intent, lifecycle stage, users, product/application shapes
- languages, frameworks, libraries, target platforms, databases, and data stores
- APIs, protocols, servers, runtimes, packaging, cloud, and infrastructure
- authentication, authorization, messaging, and background processing
- observability, testing, CI/CD, release, security, privacy, and compliance
- deployment environments, architecture constraints, and explicit non-goals
- governed agent skills selected from the registry catalog

After the walkthrough, choose an existing/premade project type as the approved baseline or
create a reusable project type. The CLI downloads its governed specs, writes a structured
`.spec/project-profile.json`, creates `.spec/drafts/PROJECT_PROFILE.md`, reports the concrete
project to the registry, and submits the Markdown profile as a project-scoped draft. Review
and publish that draft in SpecRegistry before treating it as governed guidance.

The wizard also installs selected agent procedures under `.spec/skills/<slug>/SKILL.md` and
records them in `.spec/skills/manifest.json`. Press Enter to install the safe built-in set,
or select registered skills by number/slug. Restricted skills are visibly labeled and should
only be selected when their procedure is appropriate. A skill organizes instructions; it does
not grant an agent permission to perform destructive, privileged, or external actions.

For existing projects, scripts, and CI, `--type` keeps the direct premade flow and skips the
walkthrough:

```sh
specreg init --server http://localhost:4000 --type "Acme Edge Device"
```

Equivalent unlinked form:

```sh
node /path/to/SDDManager/packages/cli/dist/index.js init --server http://localhost:4000 --type "Acme Edge Device"
```

For an auth-required registry, pass a login/API token with `--token` or `SPECREG_TOKEN`:

```sh
SPECREG_TOKEN=sreg_... specreg init --server https://specs.example.com --type "Acme Edge Device"
specreg check --server https://specs.example.com --token sreg_...
```

That writes:

- `specs/*.md` — governed global + project-type specs.
- `specs/.specregistry.json` — versions, hashes, and bundle signature metadata.
- `.spec/project-profile.json` — structured answers from guided new-project setup (guided path only).
- `.spec/drafts/PROJECT_PROFILE.md` — reviewable project-scoped profile generated by the walkthrough (guided path only).
- `.spec/skills/*/SKILL.md` — selected governed agent operating procedures.
- `.spec/skills/manifest.json` — skill IDs, slugs, descriptions, and risk levels installed for the project.
- `.spec/styleguides/*.md` — selected Google style guides converted to Markdown.
- `.spec/styleguides/google-styleguides.json` — fetched guide manifest with source URLs.
- `.mcp.json` — MCP server config for AI agents in that repository.
- `AGENTS.md` — root-level bootstrap instructions that point first-run agents to
  `SPECREGISTRY.md`, `.mcp.json`, governed specs, and governed skills.
- `SPECREGISTRY.md` — root-level guidance that tells humans and agents which manifest,
  specs directory, registry URL, project type, and MCP flow govern the repository.

Generated `.mcp.json` runs the MCP server through the installed CLI:

```json
{
  "mcpServers": {
    "specregistry": {
      "command": "specreg",
      "args": ["mcp"]
    }
  }
}
```

That avoids requiring a separate `specreg-mcp` binary on every agent machine. If the
registry requires auth, `specreg init` carries `SPECREG_TOKEN` into `.mcp.json` when a token
is provided or enrolled.

Do not run `specreg mcp` directly as a health check; it is a stdio server launched by an
MCP-capable host and may exit when no client keeps stdin/stdout open. Use
`specreg mcp --check` from the same environment to verify registry reachability,
authentication, project type, and agent-spec access.

During `specreg init`, the CLI scans the repository and suggests Google style guides from
[google.github.io/styleguide](https://google.github.io/styleguide/) for detected languages,
plus the documentation guide from `/docguide`. Press Enter to accept the suggested
multi-select, choose comma-separated numbers/IDs, or use flags for automation:

```sh
specreg init --styleguides suggested
specreg init --styleguides typescript,html-css,docguide
specreg init --styleguides none
specreg init --styleguides all --styleguide-dir docs/google-styleguides --force
```

Control agent skill installation for interactive or automated initialization:

```sh
specreg init --skills base
specreg init --skills load-governed-specs,plan-from-specs,verify-conformance
specreg init --skills all --skill-dir .agent/skills
specreg init --skills none
```

Admins register, disable, or delete custom skills in **Settings > AI & Search > Agent skills**.
Built-in skills can be disabled but not deleted. Catalog entries contain Markdown instructions,
a purpose description, and a `safe` or `restricted` risk label; executable payloads and secrets
do not belong in skills.

These Google guides are advisory external process inputs, not governed registry specs.
They are kept outside `specs/` so `specreg check` and `specreg sync` continue to verify only
the approved registry bundle. Re-run `specreg init --styleguides suggested --force` to
refresh the fetched copies. See [Google styleguide reference](../README-GOOGLE-STYLEGUIDES.md)
for the guide catalog, selection rules, and SDD semantics.

`specreg init` and `specreg sync` protect governed files: if a local spec has been edited
or was not previously managed by the manifest, the CLI refuses to overwrite it unless
`--force` is passed. Repo-specific generated drafts should stay outside `specs/` until
they are submitted through the registry review workflow.

Generate repo-specific draft specs from local code into `.spec/drafts`, then submit them:

```sh
specreg generate --write --examples --server https://specs.example.com --type "Acme Edge Device"
specreg submit-drafts --server https://specs.example.com --type "Acme Edge Device" --author alice
```

Use `--examples` to save companion example templates under `.spec/examples/` during the
same generation pass. Override the location with `--example-dir <path>`. These files are
kept outside `.spec/drafts/` by default so `submit-drafts` does not submit local examples
unless reviewers intentionally fold them into a governed spec.

`submit-drafts` reports the current repo to the registry and creates project-scoped drafts
for that repo. If a generated filename already exists as a global or project-type spec, the
new draft becomes a repo-specific override instead of changing the shared baseline. If the
repo already has a published project-scoped spec with that filename, the CLI opens a normal
change request. Add `--publish` to immediately publish newly-created project drafts as
`1.0.0`; existing project-scoped published specs still go through review.

Check for drift in CI:

```sh
specreg check --server https://specs.example.com
```

`check` first verifies the signed local bundle: every governed file in `specs/`
must match the SHA-256 recorded in `specs/.specregistry.json`, and the manifest
signature must verify against the registry public key. It then asks the registry
whether newer approved versions exist. The command exits non-zero for local edits,
missing governed files, unsigned/invalid manifests, missing specs, or version drift.

Synchronize when the registry has newer approved specs:

```sh
specreg sync --server https://specs.example.com
```

If local governed specs were edited after download, plain `sync` refuses to discard
those edits. Use `specreg sync --force --server https://specs.example.com` only when
you intend to restore the approved registry bundle over local changes.

`specreg init`, `specreg check`, `specreg sync`, and `specreg submit-drafts` report the
local manifest back to the registry. The Settings page shows these projects so admins can
see which repositories are using which project type, manifest path, spec count, and outdated
spec count.

### Migrating a repo to a different registry

`specreg migrate` moves a governed repository from one registry to another. Each registry
has a stable ed25519 identity key (exposed at `GET /api/v1/meta/public-key`, the same key
that signs spec bundles); the manifest records the key of the registry it was last stamped to. `migrate` compares that
recorded key with the target's key — a **different key means a genuinely different
registry**, so it reconciles the repo's specs instead of assuming they already match.

```sh
# Dry run: show what would move (safe, read-only)
specreg migrate --server https://new-registry.example.com --token sreg_...

# Apply: upload the diffs for review and stamp the manifest
specreg migrate --server https://new-registry.example.com --token sreg_... --apply
```

What it does:

- Reads the target's identity key; if it matches the recorded one, it reports "nothing to
  migrate" (override with `--force`).
- Diffs the repo's **project-scoped** specs against the target by content hash and
  classifies each as unchanged, new, or changed.
- With `--apply`, uploads new and changed specs **as review drafts / change requests**
  (never auto-published — the human approval gate still applies) and re-stamps the manifest
  with the new registry's URL and key.
- Global and project-type specs are org-owned; `migrate` reports any missing on the target
  but never pushes them, since defining org-wide specs is a registry admin's responsibility.

Compile governed specs into agent context files:

```sh
specreg compile --server https://specs.example.com --type "Web App Standard" --target claude
specreg compile --server https://specs.example.com --type "Web App Standard" --target agents
specreg compile --server https://specs.example.com --type "Web App Standard" --target cursor
```

Verify downloaded bundles offline against the registry public key:

```sh
specreg verify --server https://specs.example.com
```

Generate code metadata sidecars for AST/code-to-spec work:

```sh
specreg code-map
specreg code-map --out .spec/code-map.json --force
specreg code-map --dir specs --trace-out .spec/code-trace.json
specreg code-map --report
specreg trace-check --min-coverage 70% --max-drift 25% --fail-on-unmapped route,schema,command
```

`code-map` writes `.spec/code-map.json` with stable code IDs, entity kinds, paths,
signatures, source locations, hashes, parent links, route metadata, coverage, and drift
summaries. It also writes `.spec/code-trace.json`, which links code entities to local
Markdown specs, reports unmapped implementation surfaces, records stable-ID aliases when
prior inventory data is available, and includes a code embedding profile for future
semantic matching. The extractor uses the TypeScript compiler for TypeScript/JavaScript
AST entities and lightweight Python/SQL/config extraction for imports, functions, classes,
routes, commands, config, migrations, tables, fields, and indexes. It does not rewrite
source files. Fuzzy name/path/route text-matching links entities to specs automatically;
an explicit `// @spec[FILE#section]` comment directly above a declaration overrides that
guess with a high-confidence link to the named spec (and section, if the anchor matches
an existing heading) instead. Treat explicit annotations as evidence assertions: add them
only when the specific code entity is truly governed by that exact spec section. Do not
blanket-map files to `PROJECT_PROFILE.md`, broad requirements sections, or convenient
specs just to raise compliance coverage; report missing guidance or propose the needed
spec when no exact governing section exists.

Use `specreg code-map --report` to upload the traceability report to the registry. The CLI
uses `--type` or the local `specs/.specregistry.json` manifest to identify the project type.
Uploaded reports appear on the Reports page as code-to-spec coverage, drift severity, and
unmapped implementation counts.

Use `specreg comply` before committing governed implementation work. It prints a compact
commit evidence trailer:

```text
SpecRegistry-Compliance: PASS objective=100/100 attempt=1
SpecRegistry-Signals: coverage=100% drift=0%
SpecRegistry-Command: specreg comply
```

Agents should include that trailer, or equivalent `finish_task` evidence with verdict,
objective score, and session id, in the commit message body. If compliance cannot run or
does not pass, halt and show the exact output instead of committing.

Use `specreg trace-check` in CI to fail on insufficient code-to-spec coverage, excessive
drift, or critical unmapped entity kinds. In GitHub Actions it emits native annotations
that point at unmapped files/lines from `.spec/code-trace.json`.

Run an AI conformance audit:

```sh
specreg audit --server https://specs.example.com --type "Web App Standard" --ci
```

Every CLI command accepts `--token <token>` and also reads `SPECREG_TOKEN`. Use an
`agent` or `author` API key for repository automation, depending on which server routes
the workflow needs.

## AI Agent and MCP Usage

See [AI Agents and MCP](AGENTS_MCP.md) for generated `.mcp.json` files, MCP tool behavior,
governed agent APIs, token telemetry, and auth-required registry setup.

## CI Usage

Use `specreg check` as a drift gate:

```yaml
name: spec-drift
on: [pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: joeldg/SpecRepository/.github/actions/specreg-check@main
        with:
          server: https://specs.example.com
          token: ${{ secrets.SPECREG_TOKEN }}
          dir: specs
          comment: "true"
          fail-on-drift: "true"
          trace-check: "true"
          min-coverage: "70%"
          max-drift: "25%"
          fail-on-unmapped: route,schema,command
```

The action builds the bundled CLI, runs `specreg check` against the checked-out
repository, posts or updates a PR comment with the drift output, and fails the workflow
when drift or local governed-spec modification is detected unless `fail-on-drift` is set
to `false`. When `trace-check` is enabled, it also runs `specreg code-map` and
`specreg trace-check`, producing PR annotations for unmapped critical code entities and
failing on the configured coverage/drift thresholds.

Use `specreg audit --ci` when you want LLM-backed implementation conformance checks.
That requires a server LLM provider configured through Settings or environment variables.

## Sample Data

Fresh databases seed a **SpecRegistry Operating Baseline** into the Global project type.
These are the always-available SDD process specs that teach agents and humans how to use
the registry correctly:

- `SDD_OPERATING_MODEL.md`
- `AGENT_OPERATING_RULES.md`
- `SPEC_AUTHORING_STANDARD.md`
- `SPEC_GOVERNANCE.md`
- `TRACEABILITY_AND_OBSERVABILITY.md`
- `TOKENOMICS.md`
- `IMPLEMENTATION_EVIDENCE.md`
- `SECURITY_AND_SECRETS.md`
- `PROJECT_PROFILE.md`

Each baseline spec includes Scope, Intent, Requirements, Non-Goals, Acceptance Evidence,
Token Budget Class, Related Specs, and AI Agent Directives. Existing databases receive
missing baseline specs idempotently on startup/seed.

Beyond the built-in baseline and Acme demo seed, an **AI-SDD sample spec pack** populates a running
registry with realistic content — 6 org-wide process specs (agent operating rules, git flow,
code standards, documentation, observability, ticket workflow) plus an *Embedded Systems
Platform* project type with 8 technical contract specs (system, API, SNMP, UDP, protobuf,
config, DB schema, test strategy):

```sh
npm run sample:ai-sdd            # loads via the API into the server on :4000
# or target/authenticate explicitly:
SPECREG_SERVER=http://localhost:4000 SPECREG_TOKEN=sreg_... node samples/ai-sdd/load.mjs
```

The loader is idempotent (publishes each spec as 1.0.0, skips anything already present). See
[samples/ai-sdd/README.md](samples/ai-sdd/README.md) for the full contents.
