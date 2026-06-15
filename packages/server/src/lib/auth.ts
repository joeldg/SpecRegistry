import crypto from "node:crypto";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { Db } from "../db.js";
import { now, uuid } from "../db.js";
import { HttpError } from "../helpers.js";

export type Role = "admin" | "reviewer" | "author" | "agent";

export interface User {
  id: string;
  username: string;
  display_name: string | null;
  role: Role;
  password_hash: string | null;
  source: "local" | "ldap";
  created_at: string;
}

declare module "fastify" {
  interface FastifyRequest {
    user?: User;
  }
}

// --- Password hashing (scrypt) ---

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, expected] = stored.split(":");
  if (!salt || !expected) return false;
  const actual = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expected, "hex"));
}

// --- API tokens (stored hashed; the raw token is shown once) ---

function tokenHash(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function issueToken(db: Db, userId: string, name?: string): string {
  const token = `sreg_${crypto.randomBytes(24).toString("hex")}`;
  db.prepare("INSERT INTO tokens (id, token_hash, user_id, name, created_at) VALUES (?, ?, ?, ?, ?)").run(
    uuid(),
    tokenHash(token),
    userId,
    name ?? null,
    now()
  );
  return token;
}

export function lookupToken(db: Db, token: string): User | undefined {
  const row = db
    .prepare(
      `SELECT u.* FROM tokens t JOIN users u ON u.id = t.user_id WHERE t.token_hash = ?`
    )
    .get(tokenHash(token)) as User | undefined;
  if (row) {
    db.prepare("UPDATE tokens SET last_used_at = ? WHERE token_hash = ?").run(now(), tokenHash(token));
  }
  return row;
}

export function findUser(db: Db, username: string): User | undefined {
  return db.prepare("SELECT * FROM users WHERE username = ? COLLATE NOCASE").get(username) as
    | User
    | undefined;
}

export function createUser(
  db: Db,
  input: { username: string; role: Role; password?: string; display_name?: string; source?: "local" | "ldap" }
): User {
  const id = uuid();
  db.prepare(
    `INSERT INTO users (id, username, display_name, role, password_hash, source, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    input.username,
    input.display_name ?? null,
    input.role,
    input.password ? hashPassword(input.password) : null,
    input.source ?? "local",
    now()
  );
  return db.prepare("SELECT * FROM users WHERE id = ?").get(id) as User;
}

// --- Optional LDAP (active when LDAP_URL is set) ---

export function ldapEnabled(): boolean {
  return Boolean(process.env.LDAP_URL);
}

/**
 * Authenticate against LDAP. Two modes:
 *  - Direct bind:  LDAP_BIND_DN_TEMPLATE="uid={username},ou=people,dc=example,dc=com"
 *  - Search+bind:  LDAP_BIND_USER/LDAP_BIND_PASSWORD service account +
 *                  LDAP_SEARCH_BASE + LDAP_SEARCH_FILTER="(uid={username})"
 * Role mapping: membership of LDAP_ADMIN_GROUP / LDAP_REVIEWER_GROUP DNs; default author.
 */
export async function ldapAuthenticate(username: string, password: string): Promise<{ role: Role; displayName?: string }> {
  const { Client } = await import("ldapts");
  const client = new Client({ url: process.env.LDAP_URL! });
  try {
    let userDn: string;
    let groups: string[] = [];
    let displayName: string | undefined;

    if (process.env.LDAP_BIND_DN_TEMPLATE) {
      userDn = process.env.LDAP_BIND_DN_TEMPLATE.replaceAll("{username}", username);
    } else {
      if (!process.env.LDAP_SEARCH_BASE) {
        throw new HttpError(503, "LDAP misconfigured: set LDAP_BIND_DN_TEMPLATE or LDAP_SEARCH_BASE");
      }
      if (process.env.LDAP_BIND_USER) {
        await client.bind(process.env.LDAP_BIND_USER, process.env.LDAP_BIND_PASSWORD ?? "");
      }
      const filter = (process.env.LDAP_SEARCH_FILTER ?? "(uid={username})").replaceAll("{username}", username);
      const { searchEntries } = await client.search(process.env.LDAP_SEARCH_BASE, {
        filter,
        attributes: ["dn", "cn", "memberOf"],
      });
      if (searchEntries.length !== 1) throw new HttpError(401, "Invalid credentials");
      userDn = searchEntries[0].dn;
      displayName = String(searchEntries[0].cn ?? "") || undefined;
      const memberOf = searchEntries[0].memberOf;
      groups = Array.isArray(memberOf) ? memberOf.map(String) : memberOf ? [String(memberOf)] : [];
    }

    await client.bind(userDn, password); // throws on bad credentials

    if (groups.length === 0) {
      // Direct-bind mode: read memberOf as the user
      try {
        const { searchEntries } = await client.search(userDn, { scope: "base", attributes: ["cn", "memberOf"] });
        const memberOf = searchEntries[0]?.memberOf;
        groups = Array.isArray(memberOf) ? memberOf.map(String) : memberOf ? [String(memberOf)] : [];
        displayName = displayName ?? (String(searchEntries[0]?.cn ?? "") || undefined);
      } catch {
        // group lookup is best-effort
      }
    }

    return { role: mapLdapGroupsToRole(groups), displayName };
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw new HttpError(401, "Invalid credentials");
  } finally {
    await client.unbind().catch(() => {});
  }
}

export function mapLdapGroupsToRole(groups: string[]): Role {
  const normalized = groups.map((g) => g.toLowerCase());
  const admin = process.env.LDAP_ADMIN_GROUP?.toLowerCase();
  const reviewer = process.env.LDAP_REVIEWER_GROUP?.toLowerCase();
  if (admin && normalized.includes(admin)) return "admin";
  if (reviewer && normalized.includes(reviewer)) return "reviewer";
  return "author";
}

// --- Request authentication + role policy ---

const ROLE_RANK: Record<Role, number> = { agent: 0, author: 1, reviewer: 2, admin: 3 };

/** Paths reachable without a token even when auth is required. */
const PUBLIC_PATHS = [
  "/api/v1/health",
  "/api/v1/auth/login",
  "/api/v1/meta/public-key",
  "/api/v1/integrations/", // verified by their own HMAC secrets
];

/** Minimum role per route pattern, enforced only for authenticated identities. */
const POLICIES: Array<{ method: RegExp; path: RegExp; min: Role }> = [
  { method: /POST/, path: /^\/api\/v1\/reviews\/[^/]+\/(approve|reject)$/, min: "reviewer" },
  { method: /POST/, path: /^\/api\/v1\/specs\/[^/]+\/promote$/, min: "reviewer" },
  { method: /POST|PUT|DELETE/, path: /^\/api\/v1\/(templates|webhooks|subscriptions)(\/|$)/, min: "admin" },
  { method: /POST/, path: /^\/api\/v1\/sync-jobs\/run$/, min: "admin" },
  { method: /GET|POST|PUT|DELETE/, path: /^\/api\/v1\/auth\/users(\/|$)/, min: "admin" },
  { method: /GET|POST|DELETE/, path: /^\/api\/v1\/auth\/api-keys(\/|$)/, min: "admin" },
  { method: /POST|PUT/, path: /^\/api\/v1\/specs(\/|$)/, min: "author" },
  { method: /POST|PUT/, path: /^\/api\/v1\/project-types(\/|$)/, min: "author" },
];

export function registerAuth(app: FastifyInstance, opts: { authRequired: boolean }): void {
  app.addHook("onRequest", async (req) => {
    const header = req.headers.authorization;
    const raw =
      (typeof header === "string" && header.startsWith("Bearer ") ? header.slice(7) : undefined) ??
      (req.headers["x-api-key"] as string | undefined);
    if (raw) {
      req.user = lookupToken(app.db, raw);
      if (!req.user) throw new HttpError(401, "Invalid or revoked token");
    }

    const path = req.url.split("?")[0];
    if (PUBLIC_PATHS.some((p) => path === p || path.startsWith(p))) return;

    if (opts.authRequired && !req.user) {
      throw new HttpError(401, "Authentication required (Bearer token or x-api-key)");
    }
    if (req.user) {
      for (const policy of POLICIES) {
        if (policy.method.test(req.method) && policy.path.test(path)) {
          if (ROLE_RANK[req.user.role] < ROLE_RANK[policy.min]) {
            throw new HttpError(403, `Requires role ${policy.min} or higher (you are ${req.user.role})`);
          }
          break;
        }
      }
    }
  });
}

/** Review routing: per-project-type required reviewers (admins bypass). */
export function enforceRequiredReviewers(
  db: Db,
  projectTypeId: string,
  reviewerName: string,
  req: FastifyRequest
): void {
  const row = db.prepare("SELECT required_reviewers FROM project_types WHERE id = ?").get(projectTypeId) as
    | { required_reviewers: string }
    | undefined;
  const required: string[] = JSON.parse(row?.required_reviewers ?? "[]");
  if (required.length === 0) return;
  if (req.user?.role === "admin") return;
  const identity = req.user?.username ?? reviewerName;
  if (!required.some((r) => r.toLowerCase() === identity.toLowerCase())) {
    throw new HttpError(403, `This project type requires review by one of: ${required.join(", ")}`);
  }
}
