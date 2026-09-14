import { describe, it, expect } from "vitest";
import {
  allow,
  deny,
  defer,
  validatePolicyDecision,
  policyDecisionFromActorContext,
  type PolicyDecision,
} from "@/coagentica/operations-kernel/contracts/policy";
import { createActorContext, createTenantContext } from "@/coagentica/foundation/contracts/tenancy";
import type { Role, VisibilityMode } from "@/lib/auth/types";

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

const baseActorContext = createActorContext({
  actorId: "actor-789",
  actorType: "human",
  tenantContext: createTenantContext(baseTenantParams),
  correlationId: "corr-abc",
});

describe("coagentica/operations-kernel/contracts/policy", () => {
  describe("allow", () => {
    it("cria PolicyDecision com decision allow", () => {
      const decision = allow({ reason: "User has permission", tenantId: "tenant-123", actorId: "actor-789", correlationId: "corr-abc" });
      expect(decision.decision).toBe("allow");
      expect(decision.reason).toBe("User has permission");
      expect(decision.tenantId).toBe("tenant-123");
      expect(decision.actorId).toBe("actor-789");
      expect(decision.correlationId).toBe("corr-abc");
    });
  });

  describe("deny", () => {
    it("cria PolicyDecision com decision deny", () => {
      const decision = deny({ reason: "Insufficient role", tenantId: "tenant-123", actorId: "actor-789", correlationId: "corr-abc", requiredRole: "manager" });
      expect(decision.decision).toBe("deny");
      expect(decision.requiredRole).toBe("manager");
    });
  });

  describe("defer", () => {
    it("cria PolicyDecision com decision defer e retryAt", () => {
      const decision = defer({ reason: "Waiting for approval", tenantId: "tenant-123", actorId: "actor-789", correlationId: "corr-abc", retryAt: "2026-01-15T12:00:00Z" });
      expect(decision.decision).toBe("defer");
    });
    it("lança erro quando retryAt está vazio", () => {
      expect(() => defer({ reason: "wait", tenantId: "t1", actorId: "a1", correlationId: "c1", retryAt: "" })).toThrow("retryAt é obrigatório para decisão defer");
    });
  });

  describe("validatePolicyDecision", () => {
    it("retorna array vazio para decisão válida", () => {
      const decision = allow({ reason: "ok", tenantId: "t1", actorId: "a1", correlationId: "c1" });
      expect(validatePolicyDecision(decision)).toHaveLength(0);
    });
    it("retorna erro para defer sem retryAt", () => {
      const decision: PolicyDecision = { decision: "defer", reason: "wait", tenantId: "t1", actorId: "a1", correlationId: "c1" };
      const errors = validatePolicyDecision(decision);
      expect(errors).toContain("retryAt é obrigatório para decisão defer");
    });
  });

  describe("policyDecisionFromActorContext", () => {
    it("cria allow a partir de ActorContext", () => {
      const decision = policyDecisionFromActorContext(baseActorContext, "allow", "User authorized");
      expect(decision.decision).toBe("allow");
      expect(decision.tenantId).toBe("tenant-123");
    });
    it("lança erro ao criar defer sem retryAt", () => {
      expect(() => policyDecisionFromActorContext(baseActorContext, "defer", "Pending")).toThrow("retryAt é obrigatório para decisão defer");
    });
  });
});
