import { getDb } from "@/lib/db";

// Positive approval tests start from an operator-reviewed proof. Keep rejected
// and already approved states intact so negative/duplicate cases still exercise them.
export function prepareProofForApproval(id: string): string {
  getDb().prepare("UPDATE pl_design_versions SET status = 'preflight_passed' WHERE id = ? AND status = 'preflight_pending'").run(id);
  return id;
}
