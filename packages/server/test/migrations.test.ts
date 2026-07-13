import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createDb } from "../src/db.js";

const OLD_LOAD_SPECS_TEXT =
  "Before non-trivial work, use the SpecRegistry MCP get_specs tool for the configured project type and repository. Check the local manifest for drift. Treat published specs as authoritative and do not treat drafts as approved guidance.";
const OLD_RUN_COMPLIANCE_TEXT =
  "Before declaring a task done, call finish_task with your session_id (or check_compliance, or run specreg comply for CLI/CI). If it is not compliant, keep remediating and re-run — a self-assessed 'done' is not sufficient. Do not report completion while the objective coverage/drift gate still reports outstanding items.";
const V29_RUN_COMPLIANCE_TEXT =
  "Before declaring a task done, call finish_task with your session_id (or check_compliance, or run specreg comply for CLI/CI). If it is not compliant, remediate with targeted evidence only: add @spec[FILE#section] annotations only when the code entity is truly governed by that exact section, and never blanket-map files to PROJECT_PROFILE.md or broad requirements just to raise coverage. If no section governs the behavior, report missing_guidance or propose the needed spec. If repeated compliance attempts still fail, halt autonomous remediation and show the user the exact latest output. Do not report completion while objective compliance is failing or unavailable.";
const OLD_COLLECT_EVIDENCE_TEXT =
  "Summarize commands run, test outcomes, affected specs, known residual risks, and any unverified requirement. Do not claim a check passed unless it was actually executed and its result observed.";
const OLD_OPERATING_SPEC_TEXT = `# Agent Operating Rules

## Requirements
13. Before declaring a task complete, agents must call \`finish_task\` with their \`begin_task\` session id, or run \`specreg comply\` for CLI/CI workflows, and continue working until objective compliance passes. \`check_compliance\` remains available for direct compliance checks. A self-assessment of "done" is not sufficient; the registry's objective coverage/drift gate decides. Agents must not claim completion while the check still reports outstanding items.

## Non-Goals
Host approval still applies.
`;
const OLD_EVIDENCE_SPEC_TEXT = `# Implementation Evidence

## Requirements
7. Reviewers must be able to trace acceptance evidence back to specific spec sections or explicit gaps.

## Acceptance Evidence
- PR/change summaries include commands run and observed results.
`;
const OLD_GOVERNANCE_SPEC_TEXT = `# Spec Governance

## Requirements
8. Webhooks, sync jobs, and downstream PRs must carry enough summary context for consumers to verify the change.
`;
const OLD_PROFILE_SPEC_TEXT = `# Project Profile

## Intent
A repository's profile captures the local choices that make generic project-type guidance specific: product intent, stack, data stores, runtime, deployment, compliance posture, agent skills, and explicit non-goals.

## Requirements
6. Agents must not invent missing project profile choices; they must report ambiguity or ask for a reviewed profile change.

## Acceptance Evidence
- Agent summaries respect published project-scoped profile constraints.
`;

const NEW_DEFAULT_SLUGS = [
  "register-task-session",
  "resolve-uncovered-guidance",
  "run-compliance-loop",
  "propose-not-publish",
];

const tmpDirs: string[] = [];
function tmpDbPath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "specreg-mig-"));
  tmpDirs.push(dir);
  return path.join(dir, "registry.db");
}

afterEach(() => {
  for (const dir of tmpDirs.splice(0)) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      // best effort cleanup
    }
  }
});

// Simulate a database created before the v22 skill migration: revert load-governed-specs
// to its old shipped text, drop the newer default skills, and roll schema_version back so
// the next createDb re-runs the migration and re-seeds.
function downgradeToPreV22(dbPath: string, loadSpecsText: string): void {
  const db = createDb(dbPath);
  db.prepare("UPDATE agent_skills SET instructions = ? WHERE slug = 'load-governed-specs'").run(loadSpecsText);
  db.prepare(`DELETE FROM agent_skills WHERE slug IN (${NEW_DEFAULT_SLUGS.map(() => "?").join(", ")})`).run(...NEW_DEFAULT_SLUGS);
  db.prepare("UPDATE settings SET value = '21' WHERE key = 'schema_version'").run();
  db.close();
}

describe("agent skill migration (v22)", () => {
  it("corrects the shipped load-governed-specs text and seeds the new default skills on an existing database", () => {
    const dbPath = tmpDbPath();
    downgradeToPreV22(dbPath, OLD_LOAD_SPECS_TEXT);

    const db = createDb(dbPath);
    const load = db.prepare("SELECT instructions FROM agent_skills WHERE slug = 'load-governed-specs'").get() as {
      instructions: string;
    };
    expect(load.instructions).toContain("begin_task");

    for (const slug of NEW_DEFAULT_SLUGS) {
      const row = db.prepare("SELECT risk_level, built_in, status FROM agent_skills WHERE slug = ?").get(slug);
      expect(row).toMatchObject({ risk_level: "safe", built_in: 1, status: "active" });
    }
    db.close();
  });

  it("does not clobber a load-governed-specs skill an admin has customized", () => {
    const dbPath = tmpDbPath();
    const custom = "CUSTOM admin instructions that must survive the upgrade.";
    downgradeToPreV22(dbPath, custom);

    const db = createDb(dbPath);
    const load = db.prepare("SELECT instructions FROM agent_skills WHERE slug = 'load-governed-specs'").get() as {
      instructions: string;
    };
    expect(load.instructions).toBe(custom);
    db.close();
  });
});

describe("agent skill migrations (v28-v29)", () => {
  it("tightens the shipped run-compliance-loop skill to halt instead of spamming broad annotations", () => {
    const dbPath = tmpDbPath();
    const setup = createDb(dbPath);
    setup.prepare("UPDATE agent_skills SET instructions = ? WHERE slug = 'run-compliance-loop'").run(OLD_RUN_COMPLIANCE_TEXT);
    setup.prepare("UPDATE settings SET value = '27' WHERE key = 'schema_version'").run();
    setup.close();

    const db = createDb(dbPath);
    const skill = db.prepare("SELECT instructions FROM agent_skills WHERE slug = 'run-compliance-loop'").get() as {
      instructions: string;
    };
    expect(skill.instructions).toContain("targeted evidence only");
    expect(skill.instructions).toContain("never blanket-map files to PROJECT_PROFILE.md");
    expect(skill.instructions).toContain("halt autonomous remediation");
    expect(skill.instructions).toContain("exact latest output");
    db.close();
  });

  it("does not clobber a run-compliance-loop skill an admin has customized", () => {
    const dbPath = tmpDbPath();
    const custom = "CUSTOM completion gate instructions.";
    const setup = createDb(dbPath);
    setup.prepare("UPDATE agent_skills SET instructions = ? WHERE slug = 'run-compliance-loop'").run(custom);
    setup.prepare("UPDATE settings SET value = '27' WHERE key = 'schema_version'").run();
    setup.close();

    const db = createDb(dbPath);
    const skill = db.prepare("SELECT instructions FROM agent_skills WHERE slug = 'run-compliance-loop'").get() as {
      instructions: string;
    };
    expect(skill.instructions).toBe(custom);
    db.close();
  });
});

describe("agent evidence migrations (v30-v31)", () => {
  it("adds commit evidence requirements to built-in skills and seeded operating specs", () => {
    const dbPath = tmpDbPath();
    const setup = createDb(dbPath);
    setup.prepare("UPDATE agent_skills SET instructions = ? WHERE slug = 'collect-delivery-evidence'").run(OLD_COLLECT_EVIDENCE_TEXT);
    setup.prepare("UPDATE agent_skills SET instructions = ? WHERE slug = 'run-compliance-loop'").run(V29_RUN_COMPLIANCE_TEXT);
    const ts = "2026-07-05T00:00:00.000Z";
    setup
      .prepare(
        `INSERT OR IGNORE INTO project_types
          (id, name, scope, industry, description, required_reviewers, created_at, updated_at)
         VALUES ('pt-global', 'Global', 'global', NULL, NULL, '[]', ?, ?)`
      )
      .run(ts, ts);
    setup
      .prepare(
        `INSERT OR REPLACE INTO specs
          (id, project_type_id, filename, current_version, status, content, updated_by, audit_prompt, created_at, updated_at)
         VALUES (?, ?, ?, '1.0.0', 'published', ?, 'seed', NULL, ?, ?)`
      )
      .run("spec-agent-rules", "pt-global", "AGENT_OPERATING_RULES.md", OLD_OPERATING_SPEC_TEXT, ts, ts);
    setup
      .prepare(
        `INSERT OR REPLACE INTO specs
          (id, project_type_id, filename, current_version, status, content, updated_by, audit_prompt, created_at, updated_at)
         VALUES (?, ?, ?, '1.0.0', 'published', ?, 'seed', NULL, ?, ?)`
      )
      .run("spec-evidence", "pt-global", "IMPLEMENTATION_EVIDENCE.md", OLD_EVIDENCE_SPEC_TEXT, ts, ts);
    setup
      .prepare("INSERT OR REPLACE INTO spec_versions (id, spec_id, version, content, published_by, published_at) VALUES (?, ?, '1.0.0', ?, 'seed', ?)")
      .run("version-agent-rules", "spec-agent-rules", OLD_OPERATING_SPEC_TEXT, ts);
    setup
      .prepare("INSERT OR REPLACE INTO spec_versions (id, spec_id, version, content, published_by, published_at) VALUES (?, ?, '1.0.0', ?, 'seed', ?)")
      .run("version-evidence", "spec-evidence", OLD_EVIDENCE_SPEC_TEXT, ts);
    setup.prepare("UPDATE settings SET value = '29' WHERE key = 'schema_version'").run();
    setup.close();

    const db = createDb(dbPath);
    const delivery = db.prepare("SELECT instructions FROM agent_skills WHERE slug = 'collect-delivery-evidence'").get() as {
      instructions: string;
    };
    const compliance = db.prepare("SELECT instructions FROM agent_skills WHERE slug = 'run-compliance-loop'").get() as {
      instructions: string;
    };
    const operating = db.prepare("SELECT content FROM specs WHERE filename = 'AGENT_OPERATING_RULES.md'").get() as {
      content: string;
    };
    const evidence = db.prepare("SELECT content FROM specs WHERE filename = 'IMPLEMENTATION_EVIDENCE.md'").get() as {
      content: string;
    };

    expect(delivery.instructions).toContain("SpecRegistry-Compliance");
    expect(compliance.instructions).toContain("commit");
    expect(operating.content).toContain("SpecRegistry-Compliance:");
    expect(evidence.content).toContain("commit messages");
    db.close();
  });
});

describe("agent feedback gap metadata migrations", () => {
  it("adds project_type_id/languages/topic to databases that already passed the v21 feedback rebuild", () => {
    const dbPath = tmpDbPath();
    const setup = createDb(dbPath);
    setup.exec(`
      PRAGMA foreign_keys = OFF;
      ALTER TABLE agent_feedback RENAME TO agent_feedback_current;
      CREATE TABLE agent_feedback (
        id TEXT PRIMARY KEY,
        spec_id TEXT REFERENCES specs(id),
        spec_version TEXT,
        agent_identifier TEXT NOT NULL,
        error_type TEXT NOT NULL CHECK (error_type IN ('ambiguity', 'contradiction', 'outdated', 'missing_guidance')),
        context_code_snippet TEXT,
        description TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved')),
        created_at TEXT NOT NULL
      );
      DROP TABLE agent_feedback_current;
      PRAGMA foreign_keys = ON;
      UPDATE settings SET value = '22' WHERE key = 'schema_version';
    `);
    setup.close();

    const migrated = createDb(dbPath);
    const columns = migrated.prepare("PRAGMA table_info(agent_feedback)").all() as Array<{ name: string }>;
    expect(columns.map((column) => column.name)).toEqual(
      expect.arrayContaining(["project_type_id", "languages", "topic"])
    );
    migrated.close();
  });

  it("repairs databases where agent_feedback.spec_id is still NOT NULL after prior migrations", () => {
    const dbPath = tmpDbPath();
    const setup = createDb(dbPath);
    setup.exec(`
      PRAGMA foreign_keys = OFF;
      ALTER TABLE agent_feedback RENAME TO agent_feedback_current;
      CREATE TABLE agent_feedback (
        id TEXT PRIMARY KEY,
        spec_id TEXT NOT NULL REFERENCES specs(id),
        spec_version TEXT,
        agent_identifier TEXT NOT NULL,
        error_type TEXT NOT NULL CHECK (error_type IN ('ambiguity', 'contradiction', 'outdated', 'missing_guidance')),
        context_code_snippet TEXT,
        description TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved')),
        project_type_id TEXT REFERENCES project_types(id),
        languages TEXT,
        topic TEXT,
        created_at TEXT NOT NULL
      );
      DROP TABLE agent_feedback_current;
      PRAGMA foreign_keys = ON;
      UPDATE settings SET value = '31' WHERE key = 'schema_version';
    `);
    setup.close();

    const migrated = createDb(dbPath);
    const specId = migrated.prepare("PRAGMA table_info(agent_feedback)").all().find((column: any) => column.name === "spec_id") as {
      notnull: number;
    };
    expect(specId.notnull).toBe(0);
    migrated
      .prepare(
        `INSERT INTO agent_feedback
          (id, agent_identifier, error_type, description, status, project_type_id, languages, topic, created_at)
         VALUES ('gap-1', 'agent', 'missing_guidance', 'missing gateway specs', 'open', NULL, '["Python"]', 'gateway', '2026-07-05T00:00:00.000Z')`
      )
      .run();
    const row = migrated.prepare("SELECT spec_id, error_type FROM agent_feedback WHERE id = 'gap-1'").get() as {
      spec_id: string | null;
      error_type: string;
    };
    expect(row.spec_id).toBeNull();
    expect(row.error_type).toBe("missing_guidance");
    migrated.close();
  });
});

describe("baseline/project separation migration (v33)", () => {
  it("adds reusable baseline guidance to seed-authored governance specs", () => {
    const dbPath = tmpDbPath();
    const setup = createDb(dbPath);
    const ts = "2026-07-13T00:00:00.000Z";
    setup
      .prepare(
        `INSERT OR IGNORE INTO project_types
          (id, name, scope, industry, description, required_reviewers, created_at, updated_at)
         VALUES ('pt-global-v33', 'Global v33', 'global', NULL, NULL, '[]', ?, ?)`
      )
      .run(ts, ts);
    setup
      .prepare(
        `INSERT OR REPLACE INTO specs
          (id, project_type_id, filename, current_version, status, content, updated_by, audit_prompt, created_at, updated_at)
         VALUES (?, ?, ?, '1.0.0', 'published', ?, 'seed', NULL, ?, ?)`
      )
      .run("spec-governance-v33", "pt-global-v33", "SPEC_GOVERNANCE.md", OLD_GOVERNANCE_SPEC_TEXT, ts, ts);
    setup
      .prepare(
        `INSERT OR REPLACE INTO specs
          (id, project_type_id, filename, current_version, status, content, updated_by, audit_prompt, created_at, updated_at)
         VALUES (?, ?, ?, '1.0.0', 'published', ?, 'seed', NULL, ?, ?)`
      )
      .run("spec-profile-v33", "pt-global-v33", "PROJECT_PROFILE.md", OLD_PROFILE_SPEC_TEXT, ts, ts);
    setup
      .prepare("INSERT OR REPLACE INTO spec_versions (id, spec_id, version, content, published_by, published_at) VALUES (?, ?, '1.0.0', ?, 'seed', ?)")
      .run("version-governance-v33", "spec-governance-v33", OLD_GOVERNANCE_SPEC_TEXT, ts);
    setup
      .prepare("INSERT OR REPLACE INTO spec_versions (id, spec_id, version, content, published_by, published_at) VALUES (?, ?, '1.0.0', ?, 'seed', ?)")
      .run("version-profile-v33", "spec-profile-v33", OLD_PROFILE_SPEC_TEXT, ts);
    setup.prepare("UPDATE settings SET value = '32' WHERE key = 'schema_version'").run();
    setup.close();

    const migrated = createDb(dbPath);
    const governance = migrated.prepare("SELECT content FROM specs WHERE id = 'spec-governance-v33'").get() as { content: string };
    const profile = migrated.prepare("SELECT content FROM specs WHERE id = 'spec-profile-v33'").get() as { content: string };
    expect(governance.content).toContain("Project types must represent reusable baselines");
    expect(profile.content).toContain("projects are concrete repositories");
    expect(profile.content).toContain("must be project-scoped");
    migrated.close();
  });
});

describe("token expiry migration", () => {
  it("creates the expires_at column for token rotation policy", () => {
    const dbPath = tmpDbPath();
    const db = createDb(dbPath);
    const columns = db.prepare("PRAGMA table_info(tokens)").all() as Array<{ name: string }>;
    expect(columns.map((column) => column.name)).toContain("expires_at");
    db.close();
  });
});
