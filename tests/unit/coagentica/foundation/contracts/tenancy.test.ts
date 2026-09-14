import { describe, it, expect } from "vitest";
import {
  createTenantContext,
  createActorContext,
  validateTenantContext,
  validateActorContext,
  isPermissionAllowed,
  isPermissionDenied,
  isPermissionDeferred,
  type TenantContext,
  type ActorContext,
  type PermissionDecision,
  type Role,
  type VisibilityMode,
} from "@/coagentica/foundation/contracts/tenancy";

const validRole: Role = "agent";
const validVisibilityMode: VisibilityMode = "own_and_unassigned";

const baseTenantParams = {
  tenantId: "tenant-123",
  organizationId: "org-456",
  organizationName: "Test Org",
  role: validRole,
  visibilityMode: validVisibilityMode,
  locale: "pt-BR",
  timezone: "America/Sao_Paulo",
  isPlatformAdmin: false,
};

describe("coagentica/foundation/contracts/tenancy", () => {
  describe("createTenantContext", () => {
    it("cria TenantContext válido com todos os campos", () => {
      const ctx = createTenantContext(baseTenantParams);
      expect(ctx.tenantId).toBe("tenant-123");
      expect(ctx.organizationId).toBe("org-456");
      expect(ctx.organizationName).toBe("Test Org");
      expect(ctx.role).toBe("agent");
      expect(ctx.visibilityMode).toBe("own_and_unassigned");
      expect(ctx.locale).toBe("pt-BR");
      expect(ctx.timezone).toBe("America/Sao_Paulo");
      expect(ctx.isPlatformAdmin).toBe(false);
    });

    it("lança erro quando tenantId está vazio", () => {
      expect(() => createTenantContext({ ...baseTenantParams, tenantId: "" })).toThrow("tenantId é obrigatório");
      expect(() => createTenantContext({ ...baseTenantParams, tenantId: "   " })).toThrow("tenantId é obrigatório");
    });

    it("lança erro quando organizationId está vazio", () => {
      expect(() => createTenantContext({ ...baseTenantParams, organizationId: "" })).toThrow("organizationId é obrigatório");
    });
  });

  describe("createActorContext", () => {
    const baseActorParams = {
      actorId: "actor-789",
      actorType: "human" as const,
      tenantContext: createTenantContext(baseTenantParams),
      correlationId: "corr-abc",
    };

    it("cria ActorContext válido", () => {
      const ctx = createActorContext(baseActorParams);
      expect(ctx.actorId).toBe("actor-789");
      expect(ctx.actorType).toBe("human");
      expect(ctx.correlationId).toBe("corr-abc");
      expect(ctx.causationId).toBeUndefined();
      expect(ctx.tenantContext.tenantId).toBe("tenant-123");
    });

    it("inclui causationId quando fornecido", () => {
      const ctx = createActorContext({ ...baseActorParams, causationId: "cause-xyz" });
      expect(ctx.causationId).toBe("cause-xyz");
    });

    it("lança erro quando actorId está vazio", () => {
      expect(() => createActorContext({ ...baseActorParams, actorId: "" })).toThrow("actorId é obrigatório");
    });

    it("lança erro quando correlationId está vazio", () => {
      expect(() => createActorContext({ ...baseActorParams, correlationId: "" })).toThrow("correlationId é obrigatório");
    });

    it("lança erro quando actorType é inválido", () => {
      expect(() =>
        createActorContext({ ...baseActorParams, actorType: "invalid" as "human" | "ai_agent" | "system" })
      ).toThrow("actorType inválido");
    });
  });

  describe("validateTenantContext", () => {
    it("retorna array vazio para contexto válido", () => {
      const ctx = createTenantContext(baseTenantParams);
      const errors = validateTenantContext(ctx);
      expect(errors).toHaveLength(0);
    });

    it("aceita visibilityMode all e rejeita modos fora do contrato", () => {
      const allContext = createTenantContext({ ...baseTenantParams, visibilityMode: "all" });
      expect(validateTenantContext(allContext)).toHaveLength(0);

      const invalidContext: TenantContext = {
        ...allContext,
        visibilityMode: "team" as unknown as VisibilityMode,
      };
      expect(validateTenantContext(invalidContext)).toContain("visibilityMode inválido");
    });

    it("retorna erros para campos obrigatórios ausentes", () => {
      const ctx: TenantContext = {
        tenantId: "",
        organizationId: "",
        organizationName: "",
        role: "viewer",
        visibilityMode: "own",
        locale: "",
        timezone: "",
        isPlatformAdmin: false,
      };
      const errors = validateTenantContext(ctx);
      expect(errors).toContain("tenantId é obrigatório");
      expect(errors).toContain("organizationId é obrigatório");
      expect(errors).toContain("organizationName é obrigatório");
      expect(errors).toContain("locale é obrigatório");
      expect(errors).toContain("timezone é obrigatório");
    });
  });

  describe("validateActorContext", () => {
    it("retorna array vazio para contexto válido", () => {
      const ctx = createActorContext({
        actorId: "actor-1",
        actorType: "human",
        tenantContext: createTenantContext(baseTenantParams),
        correlationId: "corr-1",
      });
      const errors = validateActorContext(ctx);
      expect(errors).toHaveLength(0);
    });

    it("valida actorId, correlationId, actorType e delega para tenantContext", () => {
      const ctx: ActorContext = {
        actorId: "",
        actorType: "invalid" as "human" | "ai_agent" | "system",
        tenantContext: {
          tenantId: "",
          organizationId: "",
          organizationName: "",
          role: "viewer",
          visibilityMode: "own",
          locale: "",
          timezone: "",
          isPlatformAdmin: false,
        },
        correlationId: "",
      };
      const errors = validateActorContext(ctx);
      expect(errors).toContain("actorId é obrigatório");
      expect(errors).toContain("correlationId é obrigatório");
      expect(errors).toContain("actorType inválido: invalid");
      expect(errors).toContain("tenantId é obrigatório");
      expect(errors).toContain("organizationId é obrigatório");
    });
  });

  describe("PermissionDecision helpers", () => {
    it("isPermissionAllowed retorna true para allow: true", () => {
      const decision: PermissionDecision = { allow: true, reason: "ok" };
      expect(isPermissionAllowed(decision)).toBe(true);
    });

    it("isPermissionAllowed retorna false para allow: false", () => {
      const decision: PermissionDecision = { allow: false, reason: "nope" };
      expect(isPermissionAllowed(decision)).toBe(false);
    });

    it("isPermissionAllowed retorna false para allow: defer", () => {
      const decision: PermissionDecision = { allow: "defer", reason: "wait", retryAt: "2026-01-01T00:00:00Z" };
      expect(isPermissionAllowed(decision)).toBe(false);
    });

    it("isPermissionDenied retorna true para allow: false", () => {
      const decision: PermissionDecision = { allow: false, reason: "nope" };
      expect(isPermissionDenied(decision)).toBe(true);
    });

    it("isPermissionDeferred retorna true para allow: defer", () => {
      const decision: PermissionDecision = { allow: "defer", reason: "wait", retryAt: "2026-01-01T00:00:00Z" };
      expect(isPermissionDeferred(decision)).toBe(true);
    });
  });
});
