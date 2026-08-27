import type { FastifyInstance } from "fastify";
import { HttpError, requireOneOf, requireProjectType, requireString } from "../helpers.js";
import {
  createUser,
  enrollAgent,
  apiTokenExpiresAt,
  agentTokenExpiresAt,
  findUser,
  hashPassword,
  issueToken,
  ldapAuthenticate,
  ldapEnabled,
  loginTokenExpiresAt,
  verifyPassword,
  type Role,
} from "../lib/auth.js";
import { actorFrom, recordAudit } from "../lib/auditLog.js";

function publicUser(user: Record<string, unknown>) {
  const { password_hash: _ignored, ...rest } = user;
  return rest;
}

type RateEntry = { count: number; resetAt: number; lockedUntil?: number };

const rateState = new Map<string, RateEntry>();

function rateLimitNumber(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function clientKey(req: { ip: string; headers: Record<string, unknown> }, route: string, identity: string): string {
  const forwarded = typeof req.headers["x-forwarded-for"] === "string" ? req.headers["x-forwarded-for"] : "";
  const ip = forwarded.split(",")[0]?.trim() || req.ip || "unknown";
  return `${route}:${ip}:${identity.toLowerCase()}`;
}

function assertNotLimited(key: string): void {
  const entry = rateState.get(key);
  if (!entry) return;
  const nowMs = Date.now();
  if (entry.lockedUntil && entry.lockedUntil > nowMs) {
    throw new HttpError(429, "Too many failed attempts; retry later");
  }
  if (entry.resetAt <= nowMs) rateState.delete(key);
}

function recordFailedAttempt(key: string): void {
  const nowMs = Date.now();
  const max = rateLimitNumber("SPECREG_AUTH_RATE_LIMIT_MAX", 5);
  const windowMs = rateLimitNumber("SPECREG_AUTH_RATE_LIMIT_WINDOW_SECONDS", 15 * 60) * 1000;
  const lockMs = rateLimitNumber("SPECREG_AUTH_RATE_LIMIT_LOCK_SECONDS", 15 * 60) * 1000;
  const current = rateState.get(key);
  const entry: RateEntry =
    current && current.resetAt > nowMs ? current : { count: 0, resetAt: nowMs + windowMs };
  entry.count += 1;
  if (entry.count >= max) entry.lockedUntil = nowMs + lockMs;
  rateState.set(key, entry);
}

function clearAttempts(key: string): void {
  rateState.delete(key);
}

function requestedExpiresAt(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string") throw new HttpError(400, "expires_at must be an ISO timestamp");
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) throw new HttpError(400, "expires_at must be an ISO timestamp");
  return parsed.toISOString();
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  // Self-service agent enrollment. Issues an agent-role token bound to a repo +
  // project type so agents authenticate as themselves (never admin). Open in dev;
  // when SPECREG_ENROLL_SECRET is set (recommended for auth-required deployments)
  // the caller must present a matching x-enroll-secret header.
  app.post("/agents/enroll", async (req, reply) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const repo = requireString(body, "repo");
    const key = clientKey(req, "agents/enroll", repo);
    assertNotLimited(key);
    const secret = process.env.SPECREG_ENROLL_SECRET;
    const authRequired = process.env.SPECREG_AUTH === "required";
    if (secret) {
      if (req.headers["x-enroll-secret"] !== secret) {
        recordFailedAttempt(key);
        throw new HttpError(401, "Invalid or missing x-enroll-secret");
      }
    } else if (authRequired) {
      throw new HttpError(403, "Agent enrollment is disabled; set SPECREG_ENROLL_SECRET on the server to enable it");
    }
    const pt = requireProjectType(app.db, requireString(body, "project_type"));
    const enrolled = enrollAgent(app.db, {
      repo,
      projectTypeId: pt.id,
      displayName: typeof body.display_name === "string" ? body.display_name : undefined,
    });
    clearAttempts(key);
    recordAudit(app.db, {
      actor: "system",
      action: "agent.enrolled",
      target_type: "user",
      target_id: enrolled.username,
      summary: `Agent enrolled for ${repo} (${pt.name})`,
      detail: { repo, project_type: pt.name },
    });
    reply.code(201);
    return { ...enrolled, project_type: pt.name };
  });

  // Local or LDAP login (LDAP wins when LDAP_URL is configured).
  app.post("/auth/login", async (req) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const username = requireString(body, "username");
    const password = requireString(body, "password");
    const key = clientKey(req, "auth/login", username);
    assertNotLimited(key);

    let user = findUser(app.db, username);
    try {
      if (ldapEnabled(app.db) && user?.source !== "local") {
        const { role, displayName } = await ldapAuthenticate(app.db, username, password);
        if (!user) {
          user = createUser(app.db, { username, role, display_name: displayName, source: "ldap" });
        } else {
          // Refresh role/name from the directory on every login.
          app.db
            .prepare("UPDATE users SET role = ?, display_name = COALESCE(?, display_name) WHERE id = ?")
            .run(role, displayName ?? null, user.id);
          user = findUser(app.db, username)!;
        }
      } else {
        if (!user?.password_hash || !verifyPassword(password, user.password_hash)) {
          throw new HttpError(401, "Invalid credentials");
        }
      }
    } catch (err) {
      if (err instanceof HttpError && err.statusCode === 401) {
        recordFailedAttempt(key);
      }
      throw err;
    }

    clearAttempts(key);
    const expiresAt = loginTokenExpiresAt();
    const token = issueToken(app.db, user.id, "login session", expiresAt);
    recordAudit(app.db, {
      actor: user.username,
      action: "auth.login",
      target_type: "user",
      target_id: user.id,
      summary: `${user.username} signed in`,
      detail: { source: user.source, role: user.role, expires_at: expiresAt },
    });
    return { token, expires_at: expiresAt, user: publicUser(user as unknown as Record<string, unknown>) };
  });

  app.get("/auth/me", async (req) => {
    if (!req.user) throw new HttpError(401, "Not authenticated");
    return publicUser(req.user as unknown as Record<string, unknown>);
  });

  app.get("/auth/users", async () => {
    return (app.db.prepare("SELECT * FROM users ORDER BY username").all() as Array<Record<string, unknown>>).map(
      publicUser
    );
  });

  app.get("/auth/api-keys", async (req) => {
    const { token_type: typeFilter, repo } = (req.query ?? {}) as { token_type?: string; repo?: string };
    const clauses: string[] = [];
    const params: unknown[] = [];
    if (typeFilter) {
      clauses.push("t.token_type = ?");
      params.push(typeFilter);
    }
    if (repo) {
      clauses.push("t.scope_repo = ?");
      params.push(repo);
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    return app.db
      .prepare(
        `SELECT t.id, t.user_id, u.username, u.role, t.name, t.token_type, t.scope_repo,
                t.created_at, t.last_used_at, t.expires_at
         FROM tokens t JOIN users u ON u.id = t.user_id
         ${where}
         ORDER BY t.created_at DESC`
      )
      .all(...params);
  });

  // Issue a dedicated narrow agent-scope token bound to a repo (issue #50 item [1]).
  // Unlike a role-based API key, this token can reach ONLY the documented
  // lifecycle/spec/feedback/telemetry endpoints — narrower than the agent role.
  // Admin-only (enforced by the route policy for /auth/api-keys). Find-or-create
  // the enrolled agent identity for the repo, then mint a token_type=agent_scope key.
  app.post("/auth/agent-scope-keys", async (req, reply) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const repo = requireString(body, "repo");
    const pt = requireProjectType(app.db, requireString(body, "project_type"));
    const username = `agent:${repo}`;
    let user = findUser(app.db, username);
    if (!user) {
      user = createUser(app.db, {
        username,
        role: "agent",
        display_name: typeof body.display_name === "string" ? body.display_name : `Agent for ${repo}`,
        repo,
        project_type_id: pt.id,
      });
    } else if (user.role !== "agent") {
      throw new HttpError(409, `Identity ${username} exists with role ${user.role}; cannot issue an agent-scope token`);
    } else {
      app.db.prepare("UPDATE users SET project_type_id = ?, repo = ? WHERE id = ?").run(pt.id, repo, user.id);
    }
    const requestedExpiry = requestedExpiresAt(body.expires_at);
    const expiresAt = requestedExpiry === undefined ? agentTokenExpiresAt() : requestedExpiry;
    const token = issueToken(app.db, user.id, (body.name as string) ?? `agent-scope (${repo})`, expiresAt, {
      tokenType: "agent_scope",
      scopeRepo: repo,
    });
    reply.code(201);
    recordAudit(app.db, {
      actor: actorFrom(req, "admin"),
      action: "agent_scope_key.created",
      target_type: "user",
      target_id: user.id,
      summary: `Agent-scope token issued for ${repo} (${pt.name})`,
      detail: { repo, project_type: pt.name, expires_at: expiresAt },
    });
    return {
      token,
      username: user.username,
      role: user.role,
      token_type: "agent_scope",
      scope_repo: repo,
      project_type: pt.name,
      expires_at: expiresAt,
    };
  });

  app.post("/auth/users", async (req, reply) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const username = requireString(body, "username");
    const role = requireOneOf(body, "role", ["admin", "reviewer", "author", "agent"] as const) as Role;
    if (findUser(app.db, username)) throw new HttpError(409, `User already exists: ${username}`);
    const user = createUser(app.db, {
      username,
      role,
      password: typeof body.password === "string" ? body.password : undefined,
      display_name: typeof body.display_name === "string" ? body.display_name : undefined,
    });
    reply.code(201);
    recordAudit(app.db, {
      actor: actorFrom(req, "admin"),
      action: "user.created",
      target_type: "user",
      target_id: user.id,
      summary: `User created: ${user.username}`,
      detail: { role: user.role, source: user.source },
    });
    return publicUser(user as unknown as Record<string, unknown>);
  });

  // Long-lived API keys for agents/CI. The raw token is returned exactly once.
  app.post("/auth/api-keys", async (req, reply) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const username = requireString(body, "username");
    const user = findUser(app.db, username);
    if (!user) throw new HttpError(404, `Unknown user: ${username}`);
    const requestedExpiry = requestedExpiresAt(body.expires_at);
    const expiresAt = requestedExpiry === undefined ? apiTokenExpiresAt() : requestedExpiry;
    const token = issueToken(app.db, user.id, (body.name as string) ?? "api key", expiresAt);
    reply.code(201);
    recordAudit(app.db, {
      actor: actorFrom(req, "admin"),
      action: "api_key.created",
      target_type: "user",
      target_id: user.id,
      summary: `API key issued for ${user.username}`,
      detail: { name: (body.name as string) ?? "api key", role: user.role, expires_at: expiresAt },
    });
    return { token, username: user.username, role: user.role, expires_at: expiresAt };
  });

  // @spec[DESIGN.md#42-server-packagesserver]
  app.delete("/auth/users/:id/tokens", async (req) => {
    const { id } = req.params as { id: string };
    const user = app.db.prepare("SELECT * FROM users WHERE id = ?").get(id) as Record<string, unknown> | undefined;
    if (!user) throw new HttpError(404, `Unknown user: ${id}`);
    const result = app.db.prepare("DELETE FROM tokens WHERE user_id = ?").run(id);
    recordAudit(app.db, {
      actor: actorFrom(req, "admin"),
      action: "api_key.bulk_revoked",
      target_type: "user",
      target_id: id,
      summary: `Revoked ${result.changes} token(s) for ${user.username}`,
    });
    return { revoked: result.changes };
  });

  // @spec[DESIGN.md#42-server-packagesserver]
  app.delete("/auth/api-keys/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const result = app.db.prepare("DELETE FROM tokens WHERE id = ?").run(id);
    if (result.changes === 0) throw new HttpError(404, `Unknown API key: ${id}`);
    recordAudit(app.db, {
      actor: actorFrom(req, "admin"),
      action: "api_key.revoked",
      target_type: "api_key",
      target_id: id,
      summary: "API key revoked",
    });
    reply.code(204);
  });

  // Password change: self-service (any user for own account) or admin reset (any account).
  app.put("/auth/users/:id/password", async (req) => {
    const { id: targetId } = req.params as { id: string };
    const body = (req.body ?? {}) as Record<string, unknown>;
    const newPassword = requireString(body, "new_password");
    if (newPassword.length < 4) throw new HttpError(400, "Password must be at least 4 characters");

    const target = app.db.prepare("SELECT * FROM users WHERE id = ?").get(targetId) as
      | Record<string, unknown>
      | undefined;
    if (!target) throw new HttpError(404, `Unknown user: ${targetId}`);

    const isSelf = req.user?.id === targetId;
    const isAdmin = req.user?.role === "admin";

    if (!isSelf && !isAdmin) {
      throw new HttpError(403, "Only admins can reset other users' passwords");
    }

    // Self-service: verify current password
    if (isSelf && !isAdmin) {
      const currentPassword = typeof body.current_password === "string" ? body.current_password : "";
      if (!currentPassword) throw new HttpError(400, "current_password is required for self-service password change");
      if (!target.password_hash || !verifyPassword(currentPassword, target.password_hash as string)) {
        throw new HttpError(401, "Current password is incorrect");
      }
    }

    const hashed = hashPassword(newPassword);
    app.db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hashed, targetId);

    recordAudit(app.db, {
      actor: actorFrom(req, "admin"),
      action: isSelf ? "user.password_changed" : "user.password_reset",
      target_type: "user",
      target_id: targetId,
      summary: isSelf
        ? `${req.user?.username} changed their password`
        : `Admin reset password for ${target.username}`,
    });

    return { success: true };
  });
}
