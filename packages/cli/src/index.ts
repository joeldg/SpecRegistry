#!/usr/bin/env node
import { runInit } from "./init.js";
import { runGenerate } from "./generate.js";
import { runSync } from "./sync.js";
import { runCompile, COMPILE_TARGETS, type CompileTarget } from "./compile.js";
import { runVerify } from "./verify.js";
import { runAudit } from "./audit.js";

const HELP = `specreg — SpecRegistry developer CLI

Usage:
  specreg init      Pull approved specs for a project type into ./specs/
  specreg generate  Scan this codebase and fetch LLM prompts to generate missing specs
  specreg check     Compare local specs to the registry; exit 1 on drift (CI gate)
  specreg sync      Like check, but pulls the latest approved specs when drift is found
  specreg compile   Render the spec set into CLAUDE.md / AGENTS.md / .cursorrules
  specreg verify    Verify local spec hashes + the registry's ed25519 bundle signature
  specreg audit     Ask Claude whether this codebase violates its governed specs

Options:
  --server <url>    Registry server (default: $SPECREG_SERVER or http://localhost:4000)
  --type <name>     Project type name (skips the interactive prompt)
  --dir <path>      Spec directory (default: specs)
  --out <path>      generate: prompt output directory (default: .spec/prompts)
  --target <t>      compile: claude | agents | cursor (default: claude)
  --force           compile: overwrite a non-generated existing file
  --ci              audit: exit 1 when findings exist
  -h, --help        Show this help
`;

interface Args {
  command: string | undefined;
  flags: Record<string, string | boolean>;
}

function parseArgs(argv: string[]): Args {
  const flags: Record<string, string | boolean> = {};
  let command: string | undefined;
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
    } else if (!command) {
      command = arg;
    }
  }
  return { command, flags };
}

const { command, flags } = parseArgs(process.argv.slice(2));
const server =
  (typeof flags.server === "string" ? flags.server : undefined) ??
  process.env.SPECREG_SERVER ??
  "http://localhost:4000";

try {
  if (flags.help || command === undefined || command === "help") {
    console.log(HELP);
  } else if (command === "init") {
    await runInit({
      server,
      type: typeof flags.type === "string" ? flags.type : undefined,
      dir: typeof flags.dir === "string" ? flags.dir : "specs",
    });
  } else if (command === "generate") {
    await runGenerate({
      server,
      type: typeof flags.type === "string" ? flags.type : undefined,
      out: typeof flags.out === "string" ? flags.out : ".spec/prompts",
    });
  } else if (command === "check" || command === "sync") {
    await runSync({
      server,
      dir: typeof flags.dir === "string" ? flags.dir : "specs",
      mode: command,
    });
  } else if (command === "compile") {
    const target = typeof flags.target === "string" ? flags.target : "claude";
    if (!(COMPILE_TARGETS as readonly string[]).includes(target)) {
      throw new Error(`--target must be one of: ${COMPILE_TARGETS.join(", ")}`);
    }
    await runCompile({
      server,
      type: typeof flags.type === "string" ? flags.type : undefined,
      dir: typeof flags.dir === "string" ? flags.dir : "specs",
      target: target as CompileTarget,
      force: flags.force === true,
    });
  } else if (command === "verify") {
    const ok = await runVerify({ server, dir: typeof flags.dir === "string" ? flags.dir : "specs" });
    if (!ok) process.exit(1);
  } else if (command === "audit") {
    await runAudit({
      server,
      type: typeof flags.type === "string" ? flags.type : undefined,
      dir: typeof flags.dir === "string" ? flags.dir : "specs",
      ci: flags.ci === true,
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
