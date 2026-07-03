import readline from "node:readline/promises";
import type { ProjectType, SpecSummary } from "@specregistry/shared";

export interface RegistryAuthOptions {
  token?: string;
}

export function registryToken(token?: string): string | undefined {
  return token ?? process.env.SPECREG_TOKEN;
}

export function withRegistryAuth(init: RequestInit = {}, token?: string): RequestInit {
  const resolved = registryToken(token);
  if (!resolved) return init;
  const headers = new Headers(init.headers);
  if (!headers.has("authorization")) headers.set("authorization", `Bearer ${resolved}`);
  return { ...init, headers };
}

function errorMessage(error: unknown): string {
  if (error && typeof error === "object" && "cause" in error) {
    const cause = (error as { cause?: unknown }).cause;
    if (cause && typeof cause === "object") {
      const code = "code" in cause && typeof cause.code === "string" ? cause.code : undefined;
      const message = "message" in cause && typeof cause.message === "string" ? cause.message : undefined;
      if (code && message) return `${code}: ${message}`;
      if (message) return message;
    }
  }
  return error instanceof Error ? error.message : String(error);
}

function networkPolicyHint(detail: string): string {
  return /policy_denied|eperm|forbidden by policy|network policy/i.test(detail)
    ? " The agent host appears to be blocking this network target; use a registry URL that is reachable from that sandbox, such as a public DNS name, VPN-accessible host, or tunnel."
    : "";
}

function httpDetail(body: { message?: string; error?: string; title?: string; detail?: string; status?: number }, fallback: string): string {
  const primary = body.message ?? body.error ?? body.title ?? fallback;
  return body.detail && body.detail !== primary ? `${primary}: ${body.detail}` : primary;
}

export async function fetchJson<T>(url: string, init?: RequestInit, token?: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, withRegistryAuth(init, token));
  } catch (err) {
    const detail = errorMessage(err);
    throw new Error(`Could not reach the registry server at ${new URL(url).origin}: ${detail}.${networkPolicyHint(detail)}`);
  }
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = (await res.json()) as { message?: string; error?: string; title?: string; detail?: string; status?: number };
      detail = httpDetail(body, detail);
    } catch {
      // non-JSON error body; keep statusText
    }
    throw new Error(`${res.status} ${detail}.${networkPolicyHint(detail)}`);
  }
  return (await res.json()) as T;
}

export async function listProjectTypes(server: string, token?: string): Promise<ProjectType[]> {
  const all = await fetchJson<ProjectType[]>(`${server}/api/v1/project-types`, undefined, token);
  return all.filter((type) => type.scope === "project_type");
}

/** Resolve a project type by flag value, or interactively if none was given. */
export async function selectProjectType(server: string, typeName?: string, token?: string): Promise<ProjectType> {
  const selectable = await listProjectTypes(server, token);
  if (selectable.length === 0) {
    throw new Error("The registry has no project types configured yet.");
  }

  if (typeName) {
    const match = selectable.find((t) => t.name.toLowerCase() === typeName.toLowerCase());
    if (!match) {
      throw new Error(
        `Unknown project type "${typeName}". Available: ${selectable.map((t) => t.name).join(", ")}`
      );
    }
    return match;
  }

  console.log("\nAvailable project types:\n");
  selectable.forEach((t, i) => {
    const industry = t.industry ? `  [${t.industry}]` : "";
    console.log(`  ${i + 1}. ${t.name}${industry}`);
    if (t.description) console.log(`     ${t.description}`);
  });

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    while (true) {
      const answer = await rl.question(`\nSelect a project type [1-${selectable.length}]: `);
      const n = Number(answer.trim());
      if (Number.isInteger(n) && n >= 1 && n <= selectable.length) {
        return selectable[n - 1];
      }
      console.log("Invalid selection, try again.");
    }
  } finally {
    rl.close();
  }
}

export async function specsForProjectType(server: string, projectTypeId: string, token?: string, projectId?: string): Promise<SpecSummary[]> {
  if (projectId) return await fetchJson<SpecSummary[]>(`${server}/api/v1/specs?project_id=${encodeURIComponent(projectId)}`, undefined, token);
  const all = await fetchJson<SpecSummary[]>(`${server}/api/v1/specs`, undefined, token);
  return all.filter((spec) => spec.project_type_id === projectTypeId || spec.project_type_scope === "global");
}
