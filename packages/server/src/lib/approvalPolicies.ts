import type { Spec } from "@specregistry/shared";
import type { Db } from "../db.js";

export interface ApprovalPolicy {
  id: string;
  project_type_id: string | null;
  filename_glob: string;
  min_approvals: number;
  required_reviewers: string;
  created_at: string;
  updated_at: string;
}

function matchesGlob(glob: string, filename: string): boolean {
  if (glob === "*") return true;
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, "\\$&").replaceAll("*", ".*");
  return new RegExp(`^${escaped}$`, "i").test(filename);
}

export function policyForSpec(db: Db, spec: Spec): ApprovalPolicy | undefined {
  const policies = db
    .prepare(
      `SELECT * FROM approval_policies
       WHERE project_type_id = ? OR project_type_id IS NULL
       ORDER BY project_type_id IS NULL ASC, filename_glob = '*' ASC, created_at DESC`
    )
    .all(spec.project_type_id) as ApprovalPolicy[];
  return policies.find((p) => matchesGlob(p.filename_glob, spec.filename));
}

export function requiredApprovalCount(db: Db, spec: Spec): number {
  return policyForSpec(db, spec)?.min_approvals ?? 1;
}

export function policyReviewers(db: Db, spec: Spec): string[] {
  const policy = policyForSpec(db, spec);
  if (!policy) return [];
  try {
    return JSON.parse(policy.required_reviewers) as string[];
  } catch {
    return [];
  }
}

export function approvalCount(db: Db, changeRequestId: string): number {
  const row = db
    .prepare("SELECT COUNT(*) AS n FROM review_approvals WHERE change_request_id = ?")
    .get(changeRequestId) as { n: number };
  return row.n;
}
