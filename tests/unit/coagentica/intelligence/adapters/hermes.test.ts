import { describe, it, expect } from "vitest";
import {
  createHermesAdapter,
  isHermesAvailable,
  requireHermesAdapter,
  toOrchestratorPort,
} from "@/coagentica/intelligence/adapters/hermes";
import { createTenantContext, createActorContext } from "@/coagentica/foundation/contracts/tenancy";
import {
  createIntelligenceRequest,
  createContextEnvelope,
  createCapabilityInvocation,
  createDecisionRecord,
} from "@/coagentica/intelligence/contracts";

function createValidPortSeed() {
  const tenantContext = createTenantContext({
    tenantId: "tenant-1",
    organizationId: "org-1",
    organizationName: "Org Teste",
    role: "agent",
    visibilityMode: "own",
    locale: "pt-BR",
    timezone: "America/Sao_Paulo",
    isPlatformAdmin: false,
  });
  const actorContext = createActorContext({
    actorId: "actor-1",
    actorType: "agent",
    tenantContext,
    correlationId: "corr-1",
  });
  return {
    request: createIntelligenceRequest({
      requestId: "req-1",
      tenantContext,
      actorContext,
      capability: "orchestrate",
      input: {},
    }),
    context: createContextEnvelope({ tenantContext, actorContext }),
    invocation: createCapabilityInvocation({
      invocationId: "inv-1",
      capability: "orchestrate",
      input: {},
      actorContext,
    }),
    decision: createDecisionRecord({
      decisionId: "dec-1",
      tenantId: tenantContext.tenantId,
      actorId: actorContext.actorId,
      correlationId: "corr-1",
      capability: "orchestrate",
      decision: "allow",
      reason: "contexto válido",
      inputHash: "hash-1",
    }),
  };
}

describe("coagentica/intelligence/adapters/hermes", () => {
  describe("createHermesAdapter", () => {
    it("cria adapter com available=true quando endpoint é fornecido", () => {
      const adapter = createHermesAdapter({ endpoint: "https://hermes.example.com" });
      expect(adapter.available).toBe(true);
      expect(adapter.config.endpoint).toBe("https://hermes.example.com");
    });
    it("cria adapter com available=false quando endpoint não é fornecido", () => {
      const adapter = createHermesAdapter({});
      expect(adapter.available).toBe(false);
    });
  });

  describe("isHermesAvailable", () => {
    it("retorna true quando adapter está disponível", () => {
      const adapter = createHermesAdapter({ endpoint: "https://hermes.example.com" });
      expect(isHermesAvailable(adapter)).toBe(true);
    });
    it("retorna false quando adapter não está disponível", () => {
      const adapter = createHermesAdapter({});
      expect(isHermesAvailable(adapter)).toBe(false);
    });
  });

  describe("requireHermesAdapter", () => {
    it("retorna adapter quando disponível", () => {
      const adapter = createHermesAdapter({ endpoint: "https://hermes.example.com" });
      expect(requireHermesAdapter(adapter)).toBe(adapter);
    });
    it("lança erro quando não disponível", () => {
      const adapter = createHermesAdapter({});
      expect(() => requireHermesAdapter(adapter)).toThrow("Hermes adapter is not configured");
    });
  });

  describe("toOrchestratorPort", () => {
    it("retorna null quando adapter não está disponível", () => {
      const adapter = createHermesAdapter({});
      expect(toOrchestratorPort(adapter, createValidPortSeed())).toBeNull();
    });
    it("retorna OrchestratorPort quando disponível", () => {
      const adapter = createHermesAdapter({ endpoint: "https://hermes.example.com" });
      const seed = createValidPortSeed();
      const port = toOrchestratorPort(adapter, seed);
      expect(port).not.toBeNull();
      expect(port?.request.tenantContext.tenantId).toBe("tenant-1");
      expect(port?.decision.tenantId).toBe("tenant-1");
    });
  });
});
