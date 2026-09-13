import { describe, it, expect } from "vitest";
import {
  allow,
  deny,
  defer,
  isAllowed,
  isDenied,
  isDeferred,
  validatePolicyDecision,
  policyDecisionFromActorContext,
  type PolicyDecision,
} from "@/coagentica/business-engine/contracts/policy";
import { createActorContext, createTenantContext } from "@/coagentica/foundation/contracts/tenancy";

const baseTenantParams = {
  tenantId: "tenant-123",
  organizationId: "org-456",
  organizationName: "Test Org",
  role: "agent" as const,
  visibilityMode: "own_and_unassigned" as const,
  locale: "pt-BR",
  timezone: "America/Sao_Paulo",
  isPlatformAdmin: false,
};

const baseActorContext = createActorContext({
  actorId: "actor-789",
  actorType: "human",
  tenantContext: createTenantContext(baseTenantParams),
  correlationId: "corr-abc",
});

describe("coagentica/business-engine/contracts/policy", () => {
  describe("allow", () => {
    it("cria PolicyDecision com decision allow", () => {
      const decision = allow({
        reason: "User has permission",
        tenantId: "tenant-123",
        actorId: "actor-789",
        correlationId: "corr-abc",
      });
      expect(decision.decision).toBe("allow");
      expect(decision.reason).toBe("User has permission");
      expect(decision.tenantId).toBe("tenant-123");
      expect(decision.actorId).toBe("actor-789");
      expect(decision.correlationId).toBe("corr-abc");
      expect(decision.requiredRole).toBeUndefined();
      expect(decision.retryAt).toBeUndefined();
    });

    it("inclui metadata quando fornecida", () => {
      const decision = allow({
        reason: "ok",
        tenantId: "t1",
        actorId: "a1",
        correlationId: "c1",
        metadata: { key: "value" },
      });
      expect(decision.metadata).toEqual({ key: "value" });
    });
  });

  describe("deny", () => {
    it("cria PolicyDecision com decision deny", () => {
      const decision = deny({
        reason: "Insufficient role",
        tenantId: "tenant-123",
        actorId: "actor-789",
        correlationId: "corr-abc",
        requiredRole: "manager",
      });
      expect(decision.decision).toBe("deny");
      expect(decision.reason).toBe("Insufficient role");
      expect(decision.requiredRole).toBe("manager");
    });

    it("não requer requiredRole", () => {
      const decision = deny({
        reason: "Blocked",
        tenantId: "t1",
        actorId: "a1",
        correlationId: "c1",
      });
      expect(decision.requiredRole).toBeUndefined();
    });
  });

  describe("defer", () => {
    it("cria PolicyDecision com decision defer e retryAt", () => {
      const decision = defer({
        reason: "Waiting for approval",
        tenantId: "tenant-123",
        actorId: "actor-789",
        correlationId: "corr-abc",
        retryAt: "2026-01-15T12:00:00Z",
      });
      expect(decision.decision).toBe("defer");
      expect(decision.reason).toBe("Waiting for approval");
      expect(decision.retryAt).toBe("2026-01-15T12:00:00Z");
    });

    it("lança erro quando retryAt está vazio", () => {
      expect(() =>
        defer({
          reason: "wait",
          tenantId: "t1",
          actorId: "a1",
          correlationId: "c1",
          retryAt: "",
        })
      ).toThrow("retryAt é obrigatório para decisão defer");
    });

    it("lança erro quando retryAt é data inválida", () => {
      expect(() =>
        defer({
          reason: "wait",
          tenantId: "t1",
          actorId: "a1",
          correlationId: "c1",
          retryAt: "invalid-date",
        })
      ).toThrow("retryAt deve ser uma data ISO-8601 válida");
    });
  });

  describe("isAllowed / isDenied / isDeferred", () => {
    it("isAllowed retorna true apenas para allow", () => {
      expect(isAllowed(allow({ reason: "x", tenantId: "t", actorId: "a", correlationId: "c" }))).toBe(true);
      expect(isAllowed(deny({ reason: "x", tenantId: "t", actorId: "a", correlationId: "c" }))).toBe(false);
      expect(isAllowed(defer({ reason: "x", tenantId: "t", actorId: "a", correlationId: "c", retryAt: "2026-01-01T00:00:00Z" }))).toBe(false);
    });

    it("isDenied retorna true apenas para deny", () => {
      expect(isDenied(deny({ reason: "x", tenantId: "t", actorId: "a", correlationId: "c" }))).toBe(true);
      expect(isDenied(allow({ reason: "x", tenantId: "t", actorId: "a", correlationId: "c" }))).toBe(false);
      expect(isDenied(defer({ reason: "x", tenantId: "t", actorId: "a", correlationId: "c", retryAt: "2026-01-01T00:00:00Z" }))).toBe(false);
    });

    it("isDeferred retorna true apenas para defer", () => {
      expect(isDeferred(defer({ reason: "x", tenantId: "t", actorId: "a", correlationId: "c", retryAt: "2026-01-01T00:00:00Z" }))).toBe(true);
      expect(isDeferred(allow({ reason: "x", tenantId: "t", actorId: "a", correlationId: "c" }))).toBe(false);
      expect(isDeferred(deny({ reason: "x", tenantId: "t", actorId: "a", correlationId: "c" }))).toBe(false);
    });
  });

  describe("validatePolicyDecision", () => {
    it("retorna array vazio para decisão válida allow", () => {
      const decision = allow({ reason: "ok", tenantId: "t1", actorId: "a1", correlationId: "c1" });
      expect(validatePolicyDecision(decision)).toHaveLength(0);
    });

    it("retorna array vazio para decisão válida deny", () => {
      const decision = deny({ reason: "nope", tenantId: "t1", actorId: "a1", correlationId: "c1" });
      expect(validatePolicyDecision(decision)).toHaveLength(0);
    });

    it("retorna array vazio para decisão válida defer com retryAt", () => {
      const decision = defer({ reason: "wait", tenantId: "t1", actorId: "a1", correlationId: "c1", retryAt: "2026-01-01T00:00:00Z" });
      expect(validatePolicyDecision(decision)).toHaveLength(0);
    });

    it("retorna erros para campos obrigatórios ausentes", () => {
      const decision: PolicyDecision = {
        decision: "allow",
        reason: "",
        tenantId: "",
        actorId: "",
        correlationId: "",
      };
      const errors = validatePolicyDecision(decision);
      expect(errors).toContain("tenantId é obrigatório");
      expect(errors).toContain("actorId é obrigatório");
      expect(errors).toContain("correlationId é obrigatório");
      expect(errors).toContain("reason é obrigatório");
    });

    it("retorna erro para defer sem retryAt", () => {
      const decision: PolicyDecision = {
        decision: "defer",
        reason: "wait",
        tenantId: "t1",
        actorId: "a1",
        correlationId: "c1",
      };
      const errors = validatePolicyDecision(decision);
      expect(errors).toContain("retryAt é obrigatório para decisão defer");
    });

    it("retorna erro para defer com retryAt inválido", () => {
      const decision: PolicyDecision = {
        decision: "defer",
        reason: "wait",
        tenantId: "t1",
        actorId: "a1",
        correlationId: "c1",
        retryAt: "invalid",
      };
      const errors = validatePolicyDecision(decision);
      expect(errors).toContain("retryAt deve ser uma data ISO-8601 válida");
    });
  });

  describe("policyDecisionFromActorContext", () => {
    it("cria allow a partir de ActorContext", () => {
      const decision = policyDecisionFromActorContext(baseActorContext, "allow", "User authorized");
      expect(decision.decision).toBe("allow");
      expect(decision.tenantId).toBe("tenant-123");
      expect(decision.actorId).toBe("actor-789");
      expect(decision.correlationId).toBe("corr-abc");
    });

    it("cria deny a partir de ActorContext com requiredRole", () => {
      const decision = policyDecisionFromActorContext(baseActorContext, "deny", "Need manager", { requiredRole: "manager" });
      expect(decision.decision).toBe("deny");
      expect(decision.requiredRole).toBe("manager");
    });

    it("cria defer a partir de ActorContext com retryAt", () => {
      const decision = policyDecisionFromActorContext(baseActorContext, "defer", "Pending", { retryAt: "2026-01-15T12:00:00Z" });
      expect(decision.decision).toBe("defer");
      expect(decision.retryAt).toBe("2026-01-15T12:00:00Z");
    });

    it("lança erro ao criar defer sem retryAt", () => {
      expect(() => policyDecisionFromActorContext(baseActorContext, "defer", "Pending")).toThrow("retryAt é obrigatório para decisão defer");
    });

    it("inclui metadata quando fornecida", () => {
      const decision = policyDecisionFromActorContext(baseActorContext, "allow", "ok", { metadata: { extra: "data" } });
      expect(decision.metadata).toEqual({ extra: "data" });
    });
  });
});
