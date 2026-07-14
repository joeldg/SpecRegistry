import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { ChangeRequest, Spec, SpecSummary } from "@specregistry/shared";
import { fetchJson, selectProjectType, specsForProjectType } from "./registry.js";
import { reportManifest, type Manifest, type ManifestRegistry } from "./repo.js";
import { resolveRegistryWorkspace } from "./workspace.js";

export interface MigrateOptions {
  /** target registry to migrate to */
  toServer: string;
  /** token for the target registry */
  token?: string;
  /** spec directory (default: specs) */
  dir: string;
  /** perform the upload + re-stamp; default is a dry-run plan */
  apply: boolean;
  /** proposer/author name recorded on drafts and change requests */
  author: string;
  /** proceed even when the target key matches the recorded one */
  force: boolean;
}

type Classification = "identical" | "missing" | "conflict";

interface RepoSpecPlan {
  filename: string;
  classification: Classification;
  target?: SpecSummary;
}

function sha256(content: string): string {
  return crypto.createHash("sha256").update(content, "utf8").digest("hex");
}

async function fetchPublicKey(server: string, token?: string): Promise<string | undefined> {
  try {
    const res = await fetchJson<{ algorithm: string; public_key: string }>(`${server}/api/v1/meta/public-key`, undefined, token);
    return res.public_key?.trim() || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Migrate a governed repository to a different SpecRegistry. Compares the target
 * registry's identity key against the one recorded in the local manifest; when they
 * differ (a genuinely different registry) it diffs the repo's project-scoped specs
 * against the target and, with --apply, uploads the missing/conflicting ones as
 * review drafts (never auto-published) and re-stamps the manifest. Org-owned specs
 * (global and project-type templates) are reported, never pushed — they are the
 * registry admins' to define, not the repo's.
 */
export async function runMigrate(opts: MigrateOptions): Promise<void> {
  const workspace = resolveRegistryWorkspace(opts.dir);
  const manifest = workspace.manifest;
  if (!manifest) {
    throw new Error(`No ${opts.dir}/.specregistry.json found. Run specreg init first, or pass --dir <specs dir>.`);
  }

  const recordedKey = manifest.registry?.public_key;
  const targetKey = await fetchPublicKey(opts.toServer, opts.token);
  if (!targetKey) {
    throw new Error(`Could not read the target registry's identity key at ${opts.toServer}/api/v1/meta/public-key. Check the URL and token.`);
  }
  if (recordedKey && recordedKey === targetKey && !opts.force) {
    console.log(`This repo is already governed by ${opts.toServer} (matching registry key). Nothing to migrate.`);
    console.log("Re-run with --force to reconcile against it anyway.");
    return;
  }
  console.log(
    recordedKey
      ? `Migrating from registry ${manifest.registry?.url ?? "(unknown url)"} to ${opts.toServer} (different identity key).`
      : `Migrating to ${opts.toServer} (no prior registry key recorded in the manifest).`
  );

  // The target must already know this project type; the repo does not create org config.
  const projectType = await selectProjectType(opts.toServer, manifest.project_type, opts.token);
  const project = await reportManifest(
    opts.toServer,
    opts.token,
    { project_type: projectType.name, specs: [] },
    opts.dir,
    "migrate"
  );
  const targetSpecs = await specsForProjectType(opts.toServer, projectType.id, opts.token, project.project_id);
  const targetByFilename = new Map(targetSpecs.map((spec) => [spec.filename, spec]));

  // Split the local governed set into repo-owned (project-scoped overrides) and
  // org-owned (global + project-type templates). Only repo-owned specs migrate.
  const repoOwned = manifest.specs.filter((s) => s.project_type && s.project_type !== "Global" && s.project_type !== manifest.project_type);
  const orgOwned = manifest.specs.filter((s) => !repoOwned.includes(s));

  const plans: RepoSpecPlan[] = [];
  for (const entry of repoOwned) {
    const localPath = path.join(workspace.specsDir, entry.filename);
    if (!fs.existsSync(localPath)) {
      console.log(`  (skip) ${entry.filename}: listed in manifest but missing on disk`);
      continue;
    }
    const localContent = fs.readFileSync(localPath, "utf8");
    const target = targetByFilename.get(entry.filename);
    if (!target) {
      plans.push({ filename: entry.filename, classification: "missing" });
      continue;
    }
    const targetSpec = await fetchJson<Spec>(`${opts.toServer}/api/v1/specs/${encodeURIComponent(target.id)}`, undefined, opts.token);
    plans.push({
      filename: entry.filename,
      classification: sha256(targetSpec.content) === sha256(localContent) ? "identical" : "conflict",
      target,
    });
  }

  const missingOrgSpecs = orgOwned.filter((s) => !targetByFilename.has(s.filename));

  // Report the plan.
  console.log(`\nProject type: ${projectType.name}`);
  console.log(`Repo-owned specs: ${repoOwned.length} · org-owned: ${orgOwned.length}`);
  const toUpload = plans.filter((p) => p.classification !== "identical");
  for (const plan of plans) {
    const verb =
      plan.classification === "identical" ? "unchanged" : plan.classification === "missing" ? "NEW (upload for review)" : "CHANGED (upload for review)";
    console.log(`  ${plan.classification === "identical" ? " " : "→"} ${plan.filename}: ${verb}`);
  }
  if (missingOrgSpecs.length > 0) {
    console.log("\nOrg-owned specs missing on the target (a registry admin must add these; not migrated):");
    for (const spec of missingOrgSpecs) console.log(`  ! ${spec.filename} (${spec.project_type})`);
  }

  if (!opts.apply) {
    console.log(
      `\nDry run. ${toUpload.length} spec(s) would be uploaded for review. Re-run with --apply to upload them and stamp the manifest.`
    );
    return;
  }

  // Apply: upload missing/conflicting repo-owned specs as review drafts / change requests.
  const uploaded: string[] = [];
  for (const plan of toUpload) {
    const content = fs.readFileSync(path.join(workspace.specsDir, plan.filename), "utf8");
    if (plan.classification === "missing" || plan.target?.effective_scope !== "project") {
      const spec = await fetchJson<Spec>(`${opts.toServer}/api/v1/specs`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          project_type_id: projectType.id,
          project_id: project.project_id,
          filename: plan.filename,
          content,
          updated_by: opts.author,
        }),
      }, opts.token);
      uploaded.push(`${plan.filename} -> project draft ${spec.id}`);
    } else if (plan.target.status === "draft") {
      await fetchJson(`${opts.toServer}/api/v1/specs/${encodeURIComponent(plan.target.id)}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content, updated_by: opts.author }),
      }, opts.token);
      uploaded.push(`${plan.filename} -> updated draft ${plan.target.id}`);
    } else {
      const cr = await fetchJson<ChangeRequest>(`${opts.toServer}/api/v1/specs/review`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          spec_id: plan.target.id,
          proposed_content: content,
          version_delta: "minor",
          proposed_by: opts.author,
          summary: `Migrated from ${manifest.registry?.url ?? "another registry"}`,
        }),
      }, opts.token);
      uploaded.push(`${plan.filename} -> change request ${cr.id}`);
    }
  }

  // Re-stamp the manifest with the new registry identity.
  const registry: ManifestRegistry = { url: opts.toServer, public_key: targetKey, stamped_at: new Date().toISOString() };
  const nextManifest: Manifest = { ...manifest, registry };
  fs.writeFileSync(workspace.manifestPath, `${JSON.stringify(nextManifest, null, 2)}\n`, "utf8");

  console.log(`\nUploaded ${uploaded.length} spec(s) for review on ${opts.toServer}:`);
  for (const item of uploaded) console.log(`  ${item}`);
  console.log(`Stamped ${path.relative(workspace.root, workspace.manifestPath)} with the new registry identity.`);
  if (uploaded.length > 0) console.log("Open the target registry's Reviews page to approve and publish the migrated specs.");
}
