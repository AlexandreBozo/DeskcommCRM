import { describe, it, expect } from "vitest";
import type {
  PolicyGatePort,
} from "@/coagentica/intelligence/ports/policy-gate-port";
import type {
  OperationalContextSelection,
  OperationalContextLimits,
} from "@/coagentica/intelligence/ports/tenant-operational-context-port";
import { createTenantContext } from "@/coagentica/foundation/contracts/tenancy";
import { createActorContext } from "@/coagentica/foundation/contracts/tenancy";
import { createIntelligenceRequest } from "@/coagentica/intelligence/contracts";

const tenantContext = createTenantContext({
  tenantId: "tenant-1",
  organizationId: "tenant-1",
  organizationName: "Org 1",
  role: "agent",
  visibilityMode: "own",
  locale: "pt-BR",
  timezone: "America/Sao_Paulo",
  isPlatformAdmin: false,
});

const actorContext = createActorContext({
  actorId: "actor-1",
  actorType: "human",
  tenantContext,
  correlationId: "corr-1",
});

describe("coagentica/intelligence/ports/policy-gate-port", () => {
  describe("PolicyGatePort", () => {
    it("define contrato com método authorize", () => {
      const port: PolicyGatePort = {
        authorize: async () => ({
          constraint: { decision: "allow", reason: "ok" },
        }),
      };
      expect(typeof port.authorize).toBe("function");
    });

    it("authorize retorna PolicyGateResult com constraint", async () => {
      const port: PolicyGatePort = {
        authorize: async () => ({
          constraint: { decision: "allow", reason: "autorizado" },
        }),
      };
      const request = createIntelligenceRequest({
        requestId: "req-1",
        tenantContext,
        actorContext,
        capability: "responder_lead",
        input: { mensagem: "oi" },
      });
      const result = await port.authorize(request);

      expect(result.constraint.decision).toBe("allow");
      expect(result.constraint.reason).toBe("autorizado");
    });

    it("authorize pode retornar deny", async () => {
      const port: PolicyGatePort = {
        authorize: async () => ({
          constraint: { decision: "deny", reason: "sem papel" },
        }),
      };
      const request = createIntelligenceRequest({
        requestId: "req-1",
        tenantContext,
        actorContext,
        capability: "responder_lead",
        input: {},
      });
      const result = await port.authorize(request);

      expect(result.constraint.decision).toBe("deny");
    });

    it("authorize pode retornar defer", async () => {
      const port: PolicyGatePort = {
        authorize: async () => ({
          constraint: { decision: "defer", reason: "tente depois", retryAt: "2026-09-15T00:00:00.000Z" },
        }),
      };
      const request = createIntelligenceRequest({
        requestId: "req-1",
        tenantContext,
        actorContext,
        capability: "responder_lead",
        input: {},
      });
      const result = await port.authorize(request);

      expect(result.constraint.decision).toBe("defer");
      expect(result.constraint.retryAt).toBe("2026-09-15T00:00:00.000Z");
    });
  });

  describe("PolicyGateResult", () => {
    it("pode conter selection e limits", async () => {
      const selection: OperationalContextSelection = {
        includeEntities: true,
        includeRelationships: false,
        entityIds: ["e1", "e2"],
      };
      const limits: OperationalContextLimits = {
        maxEntities: 10,
        maxRelationships: 5,
      };

      const port: PolicyGatePort = {
        authorize: async () => ({
          constraint: { decision: "allow", reason: "liberado" },
          selection,
          limits,
        }),
      };
      const request = createIntelligenceRequest({
        requestId: "req-1",
        tenantContext,
        actorContext,
        capability: "responder_lead",
        input: {},
      });
      const result = await port.authorize(request);

      expect(result.selection).toEqual(selection);
      expect(result.limits).toEqual(limits);
    });

    it("pode retornar sem selection nem limits", async () => {
      const port: PolicyGatePort = {
        authorize: async () => ({
          constraint: { decision: "allow", reason: "ok" },
        }),
      };
      const request = createIntelligenceRequest({
        requestId: "req-1",
        tenantContext,
        actorContext,
        capability: "responder_lead",
        input: {},
      });
      const result = await port.authorize(request);

      expect(result.selection).toBeUndefined();
      expect(result.limits).toBeUndefined();
    });

    it("selection é deny-by-default: sem selection, nenhuma fatia sensível é exposta", async () => {
      const port: PolicyGatePort = {
        authorize: async () => ({
          constraint: { decision: "allow", reason: "ok" },
        }),
      };
      const request = createIntelligenceRequest({
        requestId: "req-1",
        tenantContext,
        actorContext,
        capability: "responder_lead",
        input: {},
      });
      const result = await port.authorize(request);

      expect(result.selection).toBeUndefined();
    });
  });
});
