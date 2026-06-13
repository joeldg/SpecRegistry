import type { FastifyInstance } from "fastify";
import { HttpError, requireOneOf, requireString } from "../helpers.js";
import {
  createUser,
  findUser,
  issueToken,
  ldapAuthenticate,
  ldapEnabled,
  verifyPassword,
  type Role,
} from "../lib/auth.js";

function publicUser(user: Record<string, unknown>) {
  const { password_hash: _ignored, ...rest } = user;
  return rest;
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  // Local or LDAP login (LDAP wins when LDAP_URL is configured).
  app.post("/auth/login", async (req) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const username = requireString(body, "username");
    const password = requireString(body, "password");

    let user = findUser(app.db, username);
    if (ldapEnabled() && user?.source !== "local") {
      const { role, displayName } = await ldapAuthenticate(username, password);
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

    const token = issueToken(app.db, user.id, "login session");
    return { token, user: publicUser(user as unknown as Record<string, unknown>) };
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
    return publicUser(user as unknown as Record<string, unknown>);
  });

  // Long-lived API keys for agents/CI. The raw token is returned exactly once.
  app.post("/auth/api-keys", async (req, reply) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const username = requireString(body, "username");
    const user = findUser(app.db, username);
    if (!user) throw new HttpError(404, `Unknown user: ${username}`);
    const token = issueToken(app.db, user.id, (body.name as string) ?? "api key");
    reply.code(201);
    return { token, username: user.username, role: user.role };
  });
}
