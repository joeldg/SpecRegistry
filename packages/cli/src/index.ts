#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { loadCliEnv } from "./env.js";
import { runInit } from "./init.js";
import { runGenerate } from "./generate.js";
import { runSubmitDrafts } from "./submitDrafts.js";
import { runSync } from "./sync.js";
import { runCompile, COMPILE_TARGETS, type CompileTarget } from "./compile.js";
import { runVerify } from "./verify.js";
import { runAudit } from "./audit.js";
import { runAuditReport } from "./auditReport.js";
import { runStyleguideList, runStyleguideAdd } from "./styleguides.js";
import { runSkillsCommand, type SkillSource } from "./skills.js";
import { readStoredCredentials } from "./credentials.js";
import { runComply } from "./comply.js";
import { runScan } from "./scanCommand.js";
import { runMigrate } from "./migrate.js";
import { writeCodeInventory } from "./codeMetadata.js";
import { reportCodeTrace, type Manifest } from "./repo.js";
import { runTraceCheck, traceKinds, traceThreshold } from "./traceCheck.js";
import { checkMcpConnectivity, runMcpServer } from "./mcp.js";
import { readInstalledDefaultServer } from "./defaultServer.js";
import { resolveRegistryWorkspace } from "./workspace.js";

const HELP = `specreg — SpecRegistry developer CLI

Usage:
  specreg scan      Score this repo's spec governance (read-only, no server/login needed)
  specreg init      Walk through a new project setup, or pull a premade project type
  specreg generate  Scan this codebase and fetch LLM prompts to generate missing specs
  specreg submit-drafts  Submit generated draft specs into the registry workflow
  specreg check     Compare local specs to the registry; exit 1 on drift (CI gate)
  specreg sync      Like check, but pulls the latest approved specs when drift is found
  specreg migrate   Move this governed repo to a different registry (--server target; --apply to upload)
  specreg compile   Render the spec set into CLAUDE.md / AGENTS.md / .cursorrules
  specreg verify    Verify local spec hashes + the registry's ed25519 bundle signature
  specreg audit     Ask the configured server LLM whether this codebase violates its governed specs
  specreg audit-report  Generate deterministic project, spec, agent-run, or release/PR audit evidence
  specreg styleguide list|add  List the styleguide catalog, or pull one by id/language on demand
  specreg skills list|search|check|sync  List/search skills, verify local skill currency, or refresh them
  specreg skills sources list|add|scan  Manage marketplace skill sources
  specreg skills candidates list  List untrusted marketplace candidates
  specreg comply    Verify spec compliance (coverage/drift) before declaring work done or committing; exit 1 if not
  specreg code-map  Generate a sidecar AST/code metadata inventory with stable code IDs
  specreg trace-check  Enforce .spec/code-trace.json coverage/drift thresholds in CI
  specreg mcp       Run the SpecRegistry MCP stdio server for configured agents
  specreg mcp --check  Check registry reachability/auth for the configured MCP env

Options:
  --server <url>    Registry server (default: $SPECREG_SERVER or the downloaded registry URL)
  --token <token>   Registry Bearer/API token (default: $SPECREG_TOKEN)
  --type <name>     Premade project type name (skips the new-project walkthrough)
  --dir <path>      Spec directory (default: specs; generate --write default: .spec/drafts)
  --styleguides <s> init: suggested | all | none | comma ids (default: interactive/suggested)
  --styleguide-dir <path> init: local Google guide directory (default: .spec/styleguides)
  --skills <s>      init: base | all | none | comma skill slugs (default: interactive/base)
  --skill-dir <p>   init/skills: local governed skill directory (default: .spec/skills)
  --source-type <t> skills sources add: github_repo | github_search | local_upload | builtin_pack | manual
  --license <id>    skills sources add: source license label
  --notes <text>    skills sources add: reviewer/source notes
  --source-id <id>  skills candidates list: filter by source id
  --status <s>      skills candidates list: filter by status
  --out <path>      generate: prompt output directory (default: .spec/prompts)
                    audit-report: Markdown/JSON output path (default: stdout)
                    code-map: metadata output file (default: .spec/code-map.json)
  --trace-out <p>   code-map: traceability report file (default: .spec/code-trace.json)
  --trace <path>    trace-check: report file (default: .spec/code-trace.json)
  --min-coverage <n> trace-check: minimum coverage ratio or percent (default: 50%)
  --max-drift <n>   trace-check: maximum drift ratio or percent (default: 50%)
  --fail-on-unmapped <kinds> trace-check: comma kinds that fail CI (default: route,schema)
  --annotations <m> trace-check: github | none (default: github in GitHub Actions, else none)
  --report          code-map: upload .spec/code-trace.json coverage to the registry
  --examples        generate: write companion example templates
  --example-dir <p> generate: example template directory (default: .spec/examples)
  --target <t>      compile: claude | agents | cursor (default: claude)
  --author <name>   submit-drafts: author/proposer name (default: $USER or cli)
  --delta <d>       submit-drafts: major | minor | patch (default: minor)
  --publish         submit-drafts: publish newly-created registry drafts immediately
  --write           generate: use configured CLI LLM provider to write generated specs
  --force           Overwrite protected/generated files where supported
  --ci              audit: exit 1 when findings exist
  --score <n>       comply: your honest 0-100 self-assessed compliance score
  --apply           migrate: upload diffs for review + stamp the manifest (default: dry run)
  --json            scan: print the machine-readable report instead of the summary
                    audit-report: print/write the full JSON evidence payload
  --html <path>     scan: also write a self-contained, shareable HTML report
  --project <id>    audit-report: project id or repo slug (default: current git repo)
  --spec <id>       audit-report: generate a spec quality audit for this spec id
  --session <id>    audit-report: generate an agent run audit for this session id
  --release         audit-report: generate a release/PR audit for the project
  --changed-files <csv> audit-report release: comma-separated changed files
  --tests <csv>     audit-report release: comma-separated tests run
  --checks <csv>    audit-report release: comma-separated CI/check names
  --approvals <csv> audit-report release: comma-separated approval states
  --commit-evidence <text> audit-report release: SpecRegistry compliance trailer or finish_task evidence
  --specs-loaded <csv> audit-report release: comma-separated specs loaded
  --base <sha>      audit-report release: base commit/ref
  --head <sha>      audit-report release: head commit/ref
  --url <url>       audit-report release: PR or release URL
  --label <text>    audit-report release: display label
  -h, --help        Show this help
`;

loadCliEnv();

interface Args {
  command: string | undefined;
  positionals: string[];
  flags: Record<string, string | boolean>;
}

function parseArgs(argv: string[]): Args {
  const flags: Record<string, string | boolean> = {};
  const positionals: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else if (arg === "-h") {
      flags.help = true;
    } else {
      positionals.push(arg);
    }
  }
  return { command: positionals[0], positionals, flags };
}

const { command, positionals, flags } = parseArgs(process.argv.slice(2));
const server =
  (typeof flags.server === "string" ? flags.server : undefined) ??
  process.env.SPECREG_SERVER ??
  readInstalledDefaultServer();
const token =
  (typeof flags.token === "string" ? flags.token : undefined) ??
  process.env.SPECREG_TOKEN ??
  readStoredCredentials()?.token;

if (command && command !== "help" && command !== "scan" && !flags.help && !server) {
  throw new Error(
    "No registry server configured. Install the CLI from SpecRegistry Settings, set SPECREG_SERVER, or pass --server <url>."
  );
}

function requireServer(): string {
  if (!server) {
    throw new Error(
      "No registry server configured. Install the CLI from SpecRegistry Settings, set SPECREG_SERVER, or pass --server <url>."
    );
  }
  return server;
}

function manifestProjectType(dir: string): string | undefined {
  const { manifestPath } = resolveRegistryWorkspace(dir);
  if (!fs.existsSync(manifestPath)) return undefined;
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as Manifest;
    return manifest.project_type;
  } catch {
    return undefined;
  }
}

function skillSourceTypeFlag(value: string | boolean | undefined): SkillSource["source_type"] | undefined {
  if (typeof value !== "string") return undefined;
  if (!["github_repo", "github_search", "local_upload", "builtin_pack", "manual"].includes(value)) {
    throw new Error("--source-type must be one of: github_repo, github_search, local_upload, builtin_pack, manual");
  }
  return value as SkillSource["source_type"];
}

try {
  if (flags.help || command === undefined || command === "help") {
    console.log(HELP);
  } else if (command === "scan") {
    runScan({
      root: process.cwd(),
      dir: typeof flags.dir === "string" ? flags.dir : "specs",
      json: flags.json === true,
      html: typeof flags.html === "string" ? flags.html : undefined,
    });
  } else if (command === "migrate") {
    await runMigrate({
      toServer: requireServer(),
      token,
      dir: typeof flags.dir === "string" ? flags.dir : "specs",
      apply: flags.apply === true,
      author: typeof flags.author === "string" ? flags.author : process.env.USER || "cli",
      force: flags.force === true,
    });
  } else if (command === "init") {
    await runInit({
      server: requireServer(),
      token,
      type: typeof flags.type === "string" ? flags.type : undefined,
      dir: typeof flags.dir === "string" ? flags.dir : "specs",
      force: flags.force === true,
      styleguides: typeof flags.styleguides === "string" ? flags.styleguides : undefined,
      styleguideDir: typeof flags["styleguide-dir"] === "string" ? flags["styleguide-dir"] : ".spec/styleguides",
      skills: typeof flags.skills === "string" ? flags.skills : undefined,
      skillDir: typeof flags["skill-dir"] === "string" ? flags["skill-dir"] : ".spec/skills",
    });
  } else if (command === "generate") {
    await runGenerate({
      server: requireServer(),
      token,
      type: typeof flags.type === "string" ? flags.type : undefined,
      out: typeof flags.out === "string" ? flags.out : ".spec/prompts",
      dir: typeof flags.dir === "string" ? flags.dir : ".spec/drafts",
      exampleDir: typeof flags["example-dir"] === "string" ? flags["example-dir"] : ".spec/examples",
      examples: flags.examples === true,
      write: flags.write === true,
      force: flags.force === true,
    });
  } else if (command === "submit-drafts") {
    const delta = typeof flags.delta === "string" ? flags.delta : "minor";
    if (!["major", "minor", "patch"].includes(delta)) throw new Error("--delta must be one of: major, minor, patch");
    await runSubmitDrafts({
      server: requireServer(),
      token,
      type: typeof flags.type === "string" ? flags.type : undefined,
      dir: typeof flags.dir === "string" ? flags.dir : ".spec/drafts",
      author: typeof flags.author === "string" ? flags.author : process.env.USER || "cli",
      delta: delta as "major" | "minor" | "patch",
      publish: flags.publish === true,
      force: flags.force === true,
    });
  } else if (command === "code-map") {
    const out = typeof flags.out === "string" ? flags.out : ".spec/code-map.json";
    const specsDir = typeof flags.dir === "string" ? flags.dir : "specs";
    const inventory = writeCodeInventory({
      root: process.cwd(),
      out,
      specsDir,
      traceOut: typeof flags["trace-out"] === "string" ? flags["trace-out"] : ".spec/code-trace.json",
      force: flags.force === true,
    });
    console.log(`Wrote ${inventory.entity_count} code metadata entit${inventory.entity_count === 1 ? "y" : "ies"} to ${out}.`);
    console.log(`Wrote traceability report to ${typeof flags["trace-out"] === "string" ? flags["trace-out"] : ".spec/code-trace.json"}.`);
    console.log(`Code-to-spec coverage: ${Math.round(inventory.trace.coverage.coverage_ratio * 100)}% (${inventory.trace.coverage.linked_entity_count}/${inventory.trace.coverage.governed_entity_count}); drift ${inventory.trace.drift.severity} (${inventory.trace.drift.score}).`);
    console.log(`Languages: ${inventory.languages.join(", ") || "(none)"}`);
    if (flags.report === true) {
      const projectType = (typeof flags.type === "string" ? flags.type : undefined) ?? manifestProjectType(specsDir);
      if (!projectType) throw new Error("code-map --report requires --type or a local specs/.specregistry.json manifest with project_type.");
      const uploaded = await reportCodeTrace(requireServer(), token, projectType, inventory.trace, specsDir);
      console.log(`Reported code trace coverage to registry: ${Math.round(uploaded.coverage_ratio * 100)}% coverage, drift ${uploaded.drift_severity} (${uploaded.drift_score}).`);
    }
  } else if (command === "trace-check") {
    const ok = runTraceCheck({
      tracePath: typeof flags.trace === "string" ? flags.trace : ".spec/code-trace.json",
      minCoverage: traceThreshold(flags["min-coverage"], 0.5),
      maxDrift: traceThreshold(flags["max-drift"], 0.5),
      failOnUnmapped: traceKinds(flags["fail-on-unmapped"], ["route", "schema"]),
      annotations:
        flags.annotations === "github" || flags.annotations === "none"
          ? flags.annotations
          : process.env.GITHUB_ACTIONS === "true"
            ? "github"
            : "none",
    });
    if (!ok) process.exit(1);
  } else if (command === "mcp") {
    const mcpOptions = {
      server: requireServer(),
      token,
      projectType: typeof flags.type === "string" ? flags.type : undefined,
      repo: typeof flags.repo === "string" ? flags.repo : undefined,
    };
    if (flags.check === true) await checkMcpConnectivity(mcpOptions);
    else await runMcpServer(mcpOptions);
  } else if (command === "check" || command === "sync") {
    await runSync({
      server: requireServer(),
      token,
      dir: typeof flags.dir === "string" ? flags.dir : "specs",
      mode: command,
      force: flags.force === true,
    });
  } else if (command === "compile") {
    const target = typeof flags.target === "string" ? flags.target : "claude";
    if (!(COMPILE_TARGETS as readonly string[]).includes(target)) {
      throw new Error(`--target must be one of: ${COMPILE_TARGETS.join(", ")}`);
    }
    await runCompile({
      server: requireServer(),
      token,
      type: typeof flags.type === "string" ? flags.type : undefined,
      dir: typeof flags.dir === "string" ? flags.dir : "specs",
      target: target as CompileTarget,
      force: flags.force === true,
    });
  } else if (command === "verify") {
    const ok = await runVerify({ server: requireServer(), token, dir: typeof flags.dir === "string" ? flags.dir : "specs" });
    if (!ok) process.exit(1);
  } else if (command === "audit") {
    await runAudit({
      server: requireServer(),
      token,
      type: typeof flags.type === "string" ? flags.type : undefined,
      dir: typeof flags.dir === "string" ? flags.dir : "specs",
      ci: flags.ci === true,
    });
  } else if (command === "audit-report") {
    await runAuditReport({
      server: requireServer(),
      token,
      project: typeof flags.project === "string" ? flags.project : undefined,
      spec: typeof flags.spec === "string" ? flags.spec : undefined,
      session: typeof flags.session === "string" ? flags.session : undefined,
      release: flags.release === true,
      changedFiles: typeof flags["changed-files"] === "string" ? flags["changed-files"] : undefined,
      tests: typeof flags.tests === "string" ? flags.tests : undefined,
      checks: typeof flags.checks === "string" ? flags.checks : undefined,
      approvals: typeof flags.approvals === "string" ? flags.approvals : undefined,
      commitEvidence: typeof flags["commit-evidence"] === "string" ? flags["commit-evidence"] : undefined,
      specsLoaded: typeof flags["specs-loaded"] === "string" ? flags["specs-loaded"] : undefined,
      base: typeof flags.base === "string" ? flags.base : undefined,
      head: typeof flags.head === "string" ? flags.head : undefined,
      url: typeof flags.url === "string" ? flags.url : undefined,
      label: typeof flags.label === "string" ? flags.label : undefined,
      out: typeof flags.out === "string" ? flags.out : undefined,
      json: flags.json === true,
    });
  } else if (command === "comply") {
    const specsDir = typeof flags.dir === "string" ? flags.dir : "specs";
    const workspace = resolveRegistryWorkspace(specsDir);
    const projectType = (typeof flags.type === "string" ? flags.type : undefined) ?? workspace.manifest?.project_type;
    if (!projectType) throw new Error("comply requires --type or a local specs/.specregistry.json manifest with project_type.");
    const score = typeof flags.score === "string" ? Number(flags.score) : undefined;
    if (score !== undefined && (Number.isNaN(score) || score < 0 || score > 100)) {
      throw new Error("--score must be a number between 0 and 100");
    }
    await runComply({ server: requireServer(), token, type: projectType, dir: workspace.specsDir, root: workspace.root, score });
  } else if (command === "styleguide") {
    const sub = positionals[1];
    const styleguideDir = typeof flags["styleguide-dir"] === "string" ? flags["styleguide-dir"] : ".spec/styleguides";
    if (sub === "list") {
      runStyleguideList({ language: typeof flags.language === "string" ? flags.language : undefined });
    } else if (sub === "add") {
      const token = positionals[2] ?? (typeof flags.language === "string" ? flags.language : undefined);
      if (!token) throw new Error("Usage: specreg styleguide add <id|language>  (e.g. specreg styleguide add go)");
      await runStyleguideAdd(token, { dir: styleguideDir, force: flags.force === true });
    } else {
      throw new Error("Usage: specreg styleguide list|add <id|language>");
    }
  } else if (command === "skills") {
    const specsDir = typeof flags.dir === "string" ? flags.dir : "specs";
    await runSkillsCommand({
      server: requireServer(),
      token,
      subcommand: positionals[1],
      args: positionals.slice(2),
      projectType: (typeof flags.type === "string" ? flags.type : undefined) ?? manifestProjectType(specsDir),
      dir: typeof flags["skill-dir"] === "string" ? flags["skill-dir"] : ".spec/skills",
      force: flags.force === true,
      json: flags.json === true,
      sourceType: skillSourceTypeFlag(flags["source-type"]),
      license: typeof flags.license === "string" ? flags.license : undefined,
      notes: typeof flags.notes === "string" ? flags.notes : undefined,
      status: typeof flags.status === "string" ? flags.status : undefined,
      sourceId: typeof flags["source-id"] === "string" ? flags["source-id"] : undefined,
      query: typeof flags.query === "string" ? flags.query : undefined,
    });
  } else {
    console.error(`Unknown command: ${command}\n`);
    console.log(HELP);
    process.exit(1);
  }
} catch (err) {
  console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}
