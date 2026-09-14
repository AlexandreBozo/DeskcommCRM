import { describe, expect, it } from "vitest";
import { adaptAuditLogRow, type DeskcommAuditLogRow } from "@/coagentica/foundation/adapters/audit-log";

describe("coagentica/foundation/adapters/audit-log", () => {
  it("converte api_audit_log para AuditRecord sem carregar dependência para o contrato", () => {
    const row = {
      id: "audit-1",
      organization_id: "org-1",
      action: "authz.denied",
      actor_user_id: "user-1",
      actor_api_token_id: null,
      actor_ip: "127.0.0.1",
      actor_user_agent: "vitest",
      bypassed_rls: false,
      acting_as_platform_admin: false,
      metadata: { required_role: "admin" },
      request_id: "req-1",
      resource_id: null,
      resource_type: "settings",
      created_at: "2026-09-13T14:00:00.000Z",
    } as DeskcommAuditLogRow;

    expect(adaptAuditLogRow(row)).toEqual({
      auditId: "audit-1",
      tenantId: "org-1",
      action: "authz.denied",
      actorUserId: "user-1",
      actorApiTokenId: null,
      resourceType: "settings",
      resourceId: null,
      requestId: "req-1",
      actorIp: "127.0.0.1",
      actorUserAgent: "vitest",
      bypassedRls: false,
      actingAsPlatformAdmin: false,
      metadata: { required_role: "admin" },
      occurredAt: "2026-09-13T14:00:00.000Z",
    });
  });
});
