/**
 * TeaFloww Private Label Studio — Atomic In-Transaction Audit Logging
 * Milestone M1: Shared Architecture and Data Models
 */

import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import type { AuditActor, AuditRecord } from "./types";

export interface RecordAuditParams {
  entity_type: string;
  entity_id: string;
  revision: number;
  action: string;
  actor: AuditActor;
  diff?: unknown;
}

/**
 * Record an atomic append-only audit trail entry into `pl_audit`.
 * MUST be invoked inside an active db.transaction() block.
 */
export function recordAudit(db: Database.Database, params: RecordAuditParams): AuditRecord {
  const auditId = randomUUID();
  const diffJson = params.diff !== undefined ? JSON.stringify(params.diff) : "{}";
  const actorEmail = params.actor.actor_email ?? null;
  const reason = params.actor.reason ?? null;
  const ipAddress = params.actor.ip_address ?? null;

  db.prepare(`
    INSERT INTO pl_audit (
      id, entity_type, entity_id, revision, action,
      actor_type, actor_id, actor_email, diff_json,
      reason, ip_address, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).run(
    auditId,
    params.entity_type,
    params.entity_id,
    params.revision,
    params.action,
    params.actor.actor_type,
    params.actor.actor_id,
    actorEmail,
    diffJson,
    reason,
    ipAddress
  );

  return db
    .prepare("SELECT * FROM pl_audit WHERE id = ?")
    .get(auditId) as AuditRecord;
}

/**
 * Fetch ordered audit history for a specific entity.
 */
export function getAuditHistory(
  db: Database.Database,
  entity_type: string,
  entity_id: string
): AuditRecord[] {
  return db
    .prepare(
      "SELECT * FROM pl_audit WHERE entity_type = ? AND entity_id = ? ORDER BY revision DESC, created_at DESC"
    )
    .all(entity_type, entity_id) as AuditRecord[];
}
