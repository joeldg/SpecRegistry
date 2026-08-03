import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fetchJson } from "./registry.js";
import { repoIdentity, reportManifest } from "./repo.js";
import { resolveRegistryWorkspace } from "./workspace.js";

type ChangeStatus = "added" | "modified" | "deleted";

interface SpecChange {
  filename: string;
  status: ChangeStatus;
  base_sha256?: string;
  sha256?: string;
  content?: string;
}

interface AgentState {
  id?: string;
  workspace_id: string;
  agent_identifier: string;
  branch?: string | null;
  commit_sha?: string | null;
  manifest_hash: string;
  spec_changes: SpecChange[];
  updated_at?: string;
}

export interface AgentStateOptions {
  server: string;
  token?: string;
  dir: string;
  action: "push" | "check" | "pull" | "sync";
  agentIdentifier?: string;
}

function sha256(content: Buffer | string): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function statePath(root: string): string {
  return path.join(root, ".spec", "agent-state.json");
}

function workspaceId(root: string): string {
  const file = statePath(root);
  if (fs.existsSync(file)) {
    try {
      const current = JSON.parse(fs.readFileSync(file, "utf8")) as { workspace_id?: string };
      if (current.workspace_id?.trim()) return current.workspace_id;
    } catch {
      // Replace malformed generated state below.
    }
  }
  return crypto.randomUUID();
}

function markdownFiles(dir: string, prefix = ""): string[] {
  if (!fs.existsSync(dir)) return [];
  const files: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...markdownFiles(path.join(dir, entry.name), relative));
    else if (entry.isFile() && entry.name.endsWith(".md")) files.push(relative);
  }
  return files.sort();
}

function localState(root: string, specsDir: string, manifestPath: string, manifest: NonNullable<ReturnType<typeof resolveRegistryWorkspace>["manifest"]>, agentIdentifier?: string): AgentState {
  const base = new Map(manifest.specs.map((spec) => [spec.filename, spec.sha256]));
  const changes: SpecChange[] = [];
  for (const filename of new Set([...base.keys(), ...markdownFiles(specsDir)])) {
    const file = path.resolve(specsDir, filename);
    if (!file.startsWith(path.resolve(specsDir) + path.sep)) continue;
    const expected = base.get(filename);
    if (!fs.existsSync(file)) {
      changes.push({ filename, status: "deleted", base_sha256: expected });
      continue;
    }
    const content = fs.readFileSync(file, "utf8");
    const current = sha256(content);
    if (!expected) changes.push({ filename, status: "added", sha256: current, content });
    else if (expected !== current) changes.push({ filename, status: "modified", base_sha256: expected, sha256: current, content });
  }
  const identity = repoIdentity();
  return {
    workspace_id: workspaceId(root),
    agent_identifier: agentIdentifier?.trim() || process.env.SPECREG_AGENT || process.env.USER || "specreg-cli",
    branch: identity.branch,
    commit_sha: identity.commit_sha,
    manifest_hash: sha256(fs.readFileSync(manifestPath)),
    spec_changes: changes,
  };
}

function safeWorkspace(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
}

function writeIncoming(root: string, peer: AgentState, changes: SpecChange[]): number {
  if (changes.length === 0) return 0;
  const dir = path.join(root, ".spec", "incoming", safeWorkspace(peer.workspace_id));
  fs.mkdirSync(dir, { recursive: true });
  let written = 0;
  for (const change of changes) {
    if (change.status === "deleted" || change.content === undefined) continue;
    const target = path.resolve(dir, change.filename);
    if (!target.startsWith(path.resolve(dir) + path.sep)) continue;
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, change.content, "utf8");
    written++;
  }
  fs.writeFileSync(path.join(dir, "state.json"), `${JSON.stringify(peer, null, 2)}\n`, "utf8");
  return written;
}

// @spec[DESIGN.md#cli-design]
export async function runAgentState(opts: AgentStateOptions): Promise<void> {
  const workspace = resolveRegistryWorkspace(opts.dir);
  const manifest = workspace.manifest;
  if (!manifest) throw new Error(`No ${opts.dir}/.specregistry.json found. Run specreg init first.`);
  const current = localState(workspace.root, workspace.specsDir, workspace.manifestPath, manifest, opts.agentIdentifier);
  const repo = manifest.project?.trim() || repoIdentity().repo;

  if (opts.action === "push" || opts.action === "sync") {
    await reportManifest(opts.server, opts.token, manifest, opts.dir, "agent-state");
    const uploaded = await fetchJson<AgentState>(`${opts.server}/api/v1/cli/agent-state`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...current, repo, project_type: manifest.project_type }),
    }, opts.token);
    fs.mkdirSync(path.dirname(statePath(workspace.root)), { recursive: true });
    fs.writeFileSync(statePath(workspace.root), `${JSON.stringify(uploaded, null, 2)}\n`, "utf8");
    console.log(`Uploaded workspace state (${current.spec_changes.length} local spec change(s)).`);
    if (opts.action === "push") return;
  }

  const query = new URLSearchParams({
    repo,
    project_type: manifest.project_type,
    exclude_workspace: current.workspace_id,
  });
  const peers = await fetchJson<AgentState[]>(`${opts.server}/api/v1/cli/agent-state?${query}`, undefined, opts.token);
  const localHashes = new Map<string, string | undefined>();
  for (const spec of manifest.specs) {
    const file = path.join(workspace.specsDir, spec.filename);
    localHashes.set(spec.filename, fs.existsSync(file) ? sha256(fs.readFileSync(file)) : undefined);
  }
  let mismatches = 0;
  let incoming = 0;
  for (const peer of peers) {
    const relevant = peer.spec_changes.filter((change) => {
      const localHash = localHashes.get(change.filename);
      return change.status === "deleted" ? localHash !== undefined : change.sha256 !== localHash;
    });
    if (relevant.length === 0) continue;
    mismatches += relevant.length;
    console.log(`\nWorkspace ${peer.workspace_id} (${peer.agent_identifier}, ${peer.branch ?? "detached"}) has ${relevant.length} differing spec change(s):`);
    for (const change of relevant) {
      const localEntry = manifest.specs.find((spec) => spec.filename === change.filename);
      const localChanged = localHashes.get(change.filename) !== localEntry?.sha256;
      console.log(`  ${localChanged ? "CONFLICT" : "INCOMING"} ${change.status} ${change.filename}`);
    }
    if (opts.action === "pull" || opts.action === "sync") incoming += writeIncoming(workspace.root, peer, relevant);
  }
  if (mismatches === 0) console.log(`No differing spec changes reported by ${peers.length} other workspace(s).`);
  else if (opts.action === "pull" || opts.action === "sync") {
    console.log(`\nWrote ${incoming} incoming spec snapshot(s) under .spec/incoming/. Governed specs were not overwritten or published.`);
  } else {
    console.log("Run `specreg state pull` to copy peer snapshots into .spec/incoming/ for review.");
  }
}
