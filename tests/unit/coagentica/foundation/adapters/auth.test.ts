import { describe, expect, it } from "vitest";
import type { RoleCheck } from "@/lib/auth/require-role";
import {
  adaptRoleCheckToActorContext,
  adaptRoleCheckToPermissionDecision,
  adaptRoleCheckToTenantContext,
} from "@/coagentica/foundation/adapters/auth";

const allowed = {
  ok: true,
  user: {
    id: "user-1",
    email: "user@example.com",
    full_name: "User",
    avatar_url: null,
    is_platform_admin: false,
    idioma: "pt-BR",
    locale: "pt-BR",
    timezone: "America/Sao_Paulo",
    organizations: [],
  },
  org: {
    orgId: "org-1",
    name: "Tenant One",
    role: "manager",
    visibility_mode: "own_and_unassigned",
  },
} as unknown as RoleCheck;

const denied = {
  ok: false,
  response: {},
} as unknown as RoleCheck;

describe("coagentica/foundation/adapters/auth", () => {
  it("converte requireRole permitido em TenantContext isolado", () => {
    const tenant = adaptRoleCheckToTenantContext(allowed, { correlationId: "corr-1" });
    expect(tenant).toMatchObject({
      tenantId: "org-1",
      organizationId: "org-1",
      organizationName: "Tenant One",
      role: "manager",
      visibilityMode: "own_and_unassigned",
      actorId: "user-1",
      actorRole: "manager",
      correlationId: "corr-1",
    });
  });

  it("converte requireRole permitido em ActorContext", () => {
    const actor = adaptRoleCheckToActorContext(allowed, { correlationId: "corr-1" });
    expect(actor).toMatchObject({
      actorId: "user-1",
      actorType: "human",
      correlationId: "corr-1",
    });
    expect(actor?.tenantContext.tenantId).toBe("org-1");
  });

  it("traduz resultado do gate em PermissionDecision", () => {
    expect(adaptRoleCheckToPermissionDecision(allowed)).toEqual({
      allow: true,
      reason: "require_role_allowed",
    });
    expect(
      adaptRoleCheckToPermissionDecision(denied, { deniedReason: "forbidden_role" })
    ).toEqual({
      allow: false,
      reason: "forbidden_role",
    });
  });

  it("não fabrica contexto quando o gate nega", () => {
    expect(adaptRoleCheckToTenantContext(denied)).toBeNull();
    expect(adaptRoleCheckToActorContext(denied)).toBeNull();
  });
});
