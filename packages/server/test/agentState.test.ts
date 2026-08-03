import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { createDb } from "../src/db.js";
import { seed } from "../src/seed.js";
import { buildAdminTestApp } from "./helpers.js";

let app: FastifyInstance;

beforeEach(async () => {
  const db = createDb(":memory:");
  seed(db);
  app = await buildAdminTestApp(db);
  const report = await app.inject({
    method: "POST",
    url: "/api/v1/cli/manifest-report",
    payload: { repo: "github.com/acme/app", project_type: "Web App Standard", specs: [] },
  });
  expect(report.statusCode).toBe(200);
});

afterEach(async () => app.close());

describe("agent workspace state", () => {
  it("stores one latest unpublished spec snapshot per workspace and lists peers", async () => {
    const payload = {
      repo: "github.com/acme/app",
      project_type: "Web App Standard",
      workspace_id: "workstation-a",
      agent_identifier: "codex",
      branch: "feature/spec",
      commit_sha: "abc123",
      manifest_hash: "manifest-one",
      spec_changes: [{ filename: "DESIGN.md", status: "modified", base_sha256: "old", sha256: "new", content: "# Design\n" }],
    };
    const created = await app.inject({ method: "POST", url: "/api/v1/cli/agent-state", payload });
    expect(created.statusCode).toBe(201);
    expect(created.json().spec_changes[0].content).toBe("# Design\n");

    const updated = await app.inject({
      method: "POST",
      url: "/api/v1/cli/agent-state",
      payload: { ...payload, manifest_hash: "manifest-two", spec_changes: [] },
    });
    expect(updated.statusCode).toBe(200);

    const listed = await app.inject({
      method: "GET",
      url: "/api/v1/cli/agent-state?repo=github.com%2Facme%2Fapp&project_type=Web%20App%20Standard",
    });
    expect(listed.statusCode).toBe(200);
    expect(listed.json()).toHaveLength(1);
    expect(listed.json()[0]).toMatchObject({ workspace_id: "workstation-a", manifest_hash: "manifest-two", spec_changes: [] });
  });

  it("rejects unsafe snapshot filenames", async () => {
    const result = await app.inject({
      method: "POST",
      url: "/api/v1/cli/agent-state",
      payload: {
        repo: "github.com/acme/app",
        project_type: "Web App Standard",
        workspace_id: "workstation-a",
        agent_identifier: "codex",
        manifest_hash: "manifest",
        spec_changes: [{ filename: "../secret.md", status: "added", content: "no" }],
      },
    });
    expect(result.statusCode).toBe(400);
  });
});
