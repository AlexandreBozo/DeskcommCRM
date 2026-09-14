import { describe, expect, it } from "vitest";
import {
  createAuditRecord,
  isAuditTenantBound,
  validateAuditRecord,
} from "@/coagentica/foundation/contracts/audit";

describe("coagentica/foundation/contracts/audit", () => {
  it("cria AuditRecord canônico", () => {
    const record = createAuditRecord({
      auditId: "audit-1",
      tenantId: "org-1",
      action: "lead.updated",
      actorUserId: "user-1",
      metadata: { source: "test" },
      occurredAt: "2026-09-13T14:00:00.000Z",
    });

    expect(record).toMatchObject({
      auditId: "audit-1",
      tenantId: "org-1",
      action: "lead.updated",
      actorUserId: "user-1",
      bypassedRls: false,
      actingAsPlatformAdmin: false,
    });
    expect(record.metadata).toEqual({ source: "test" });
  });

  it("valida campos obrigatórios e data", () => {
    expect(() =>
      createAuditRecord({
        auditId: "",
        action: "x",
        occurredAt: "2026-09-13T14:00:00.000Z",
      })
    ).toThrow("auditId é obrigatório");

    const invalid = {
      auditId: "",
      tenantId: null,
      action: "",
      actorUserId: null,
      actorApiTokenId: null,
      resourceType: null,
      resourceId: null,
      requestId: null,
      actorIp: null,
      actorUserAgent: null,
      bypassedRls: false,
      actingAsPlatformAdmin: false,
      metadata: {},
      occurredAt: "invalid",
    };

    expect(validateAuditRecord(invalid)).toEqual(
      expect.arrayContaining([
        "auditId é obrigatório",
        "action é obrigatório",
        "occurredAt deve ser uma data válida",
      ])
    );
  });

  it("mantém vínculo explícito com tenant", () => {
    const record = createAuditRecord({
      auditId: "audit-1",
      tenantId: "org-1",
      action: "lead.updated",
      occurredAt: "2026-09-13T14:00:00.000Z",
    });

    expect(isAuditTenantBound(record, "org-1")).toBe(true);
    expect(isAuditTenantBound(record, "org-2")).toBe(false);
  });
});
