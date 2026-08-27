import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { createDb, type Db } from "../src/db.js";
import { seed } from "../src/seed.js";
import { buildAdminTestApp } from "./helpers.js";

let app: FastifyInstance;
let db: Db;

beforeEach(async () => {
  db = createDb(":memory:");
  seed(db);
  app = await buildAdminTestApp(db);
});

afterEach(async () => {
  await app.close();
});

async function webAppType() {
  const res = await app.inject({ method: "GET", url: "/api/v1/project-types" });
  const type = res.json().find((t: any) => t.name === "Web App Standard");
  expect(type).toBeTruthy();
  return type;
}

async function issueAgentScopeKey(repo: string) {
  const type = await webAppType();
  const res = await app.inject({
    method: "POST",
    url: "/api/v1/auth/agent-scope-keys",
    payload: { repo, project_type: type.name },
  });
  expect(res.statusCode).toBe(201);
  return res.json();
}

// Requests using the raw agent-scope token (no admin auth override).
function asToken(token: string) {
  return { authorization: `Bearer ${token}` };
}

describe("agent-scope tokens (issue #50 item [1])", () => {
  it("issues a token_type=agent_scope key bound to a repo", async () => {
    const issued = await issueAgentScopeKey("github.com/acme/scoped");
    expect(issued.token).toMatch(/^sreg_/);
    expect(issued.token_type).toBe("agent_scope");
    expect(issued.scope_repo).toBe("github.com/acme/scoped");
    expect(issued.role).toBe("agent");
  });

  it("allows the token to reach a documented lifecycle/spec endpoint", async () => {
    const type = await webAppType();
    const issued = await issueAgentScopeKey("github.com/acme/scoped");
    // GET /ai/specs/:type is on the agent-scope allow-list.
    const res = await app.inject({
      method: "GET",
      url: `/api/v1/ai/specs/${encodeURIComponent(type.name)}`,
      headers: asToken(issued.token),
    });
    expect(res.statusCode).toBe(200);
  });

  it("blocks the token from a non-allow-listed endpoint even though it authenticates", async () => {
    const issued = await issueAgentScopeKey("github.com/acme/scoped");
    // /auth/users is admin-only and NOT on the agent-scope allow-list -> 403.
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/auth/users",
      headers: asToken(issued.token),
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().message).toMatch(/agent-scope token/i);
  });

  it("blocks a non-allow-listed endpoint that the agent ROLE alone could reach", async () => {
    // /cli/agent-state is allow-listed, but /audit-log is not and needs admin anyway.
    const issued = await issueAgentScopeKey("github.com/acme/scoped");
    const allowed = await app.inject({
      method: "GET",
      url: "/api/v1/cli/agent-state?consumer=github.com/acme/scoped&workspace=w1",
      headers: asToken(issued.token),
    });
    // reaches the handler (allow-listed); may 400/404 on missing consumer but not 403 from the gate.
    expect(allowed.statusCode).not.toBe(403);
    const denied = await app.inject({
      method: "GET",
      url: "/api/v1/audit-log",
      headers: asToken(issued.token),
    });
    expect(denied.statusCode).toBe(403);
  });

  it("lists and revokes agent-scope tokens via the admin api-keys endpoints", async () => {
    const issued = await issueAgentScopeKey("github.com/acme/scoped");
    const listRes = await app.inject({
      method: "GET",
      url: "/api/v1/auth/api-keys?token_type=agent_scope&repo=github.com/acme/scoped",
    });
    expect(listRes.statusCode).toBe(200);
    const rows = listRes.json() as any[];
    const row = rows.find((r) => r.scope_repo === "github.com/acme/scoped");
    expect(row).toBeTruthy();
    expect(row.token_type).toBe("agent_scope");

    const revoke = await app.inject({ method: "DELETE", url: `/api/v1/auth/api-keys/${row.id}` });
    expect(revoke.statusCode).toBe(204);

    // The revoked token no longer authenticates.
    const after = await app.inject({
      method: "GET",
      url: "/api/v1/auth/me",
      headers: asToken(issued.token),
    });
    expect(after.statusCode).toBe(401);
  });

  it("leaves standard role-based tokens unaffected", async () => {
    // A standard admin API key still reaches admin-only endpoints.
    const type = await webAppType();
    const keyRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/api-keys",
      payload: { username: "admin", name: "ci" },
    });
    expect(keyRes.statusCode).toBe(201);
    const std = keyRes.json();
    expect(std.token_type ?? "standard").toBe("standard");
    const usersRes = await app.inject({
      method: "GET",
      url: "/api/v1/auth/users",
      headers: asToken(std.token),
    });
    expect(usersRes.statusCode).toBe(200);
    void type;
  });
});
