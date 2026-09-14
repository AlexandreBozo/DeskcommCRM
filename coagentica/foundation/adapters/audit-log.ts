import type { Database } from "@/lib/database.types";
import { createAuditRecord, type AuditRecord } from "../contracts/audit";

export type DeskcommAuditLogRow =
  Database["public"]["Tables"]["api_audit_log"]["Row"];

function metadataFromJson(value: unknown): Readonly<Record<string, unknown>> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  return { ...(value as Record<string, unknown>) };
}

export function adaptAuditLogRow(row: DeskcommAuditLogRow): AuditRecord {
  return createAuditRecord({
    auditId: row.id,
    tenantId: row.organization_id,
    action: row.action,
    actorUserId: row.actor_user_id,
    actorApiTokenId: row.actor_api_token_id,
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    requestId: row.request_id,
    actorIp: typeof row.actor_ip === "string" ? row.actor_ip : null,
    actorUserAgent: row.actor_user_agent,
    bypassedRls: row.bypassed_rls,
    actingAsPlatformAdmin: row.acting_as_platform_admin,
    metadata: metadataFromJson(row.metadata),
    occurredAt: row.created_at,
  });
}
