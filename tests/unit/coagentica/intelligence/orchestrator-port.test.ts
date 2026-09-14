import { describe, it, expect } from "vitest";
import {
  createOrchestratorPort,
  validateOrchestratorPort,
} from "@/coagentica/intelligence/orchestrator-port";
import {
  createTenantContext,
  createActorContext,
} from "@/coagentica/foundation/contracts/tenancy";
import {
  createIntelligenceRequest,
  createContextEnvelope,
  createCapabilityInvocation,
  createDecisionRecord,
  type IntelligenceRequest,
} from "@/coagentica/intelligence/contracts";
import { allow } from "@/coagentica/operations-kernel/contracts/policy";

const baseTenantContext = createTenantContext({ tenantId: "tenant-123", organizationId: "org-456", organizationName: "Test Org", role: "agent", visibilityMode: "own_and_unassigned", locale: "pt-BR", timezone: "America/Sao_Paulo", isPlatformAdmin: false });
const baseActorContext = createActorContext({ actorId: "actor-789", actorType: "human", tenantContext: baseTenantContext, correlationId: "corr-abc" });
const basePolicyDecision = allow({ reason: "Authorized", tenantId: "tenant-123", actorId: "actor-789", correlationId: "corr-abc" });

describe("coagentica/intelligence/orchestrator-port", () => {
  describe("createOrchestratorPort", () => {
    it("cria OrchestratorPort válido", () => {
      const request = createIntelligenceRequest({ requestId: "req-1", tenantContext: baseTenantContext, actorContext: baseActorContext, capability: "classify_lead", input: { message: "Hello" }, policyDecision: basePolicyDecision });
      const context = createContextEnvelope({ tenantContext: baseTenantContext, actorContext: baseActorContext });
      const invocation = createCapabilityInvocation({ invocationId: "inv-1", capability: "send_message", input: { to: "5511999999999", body: "Hello" }, actorContext: baseActorContext });
      const decision = createDecisionRecord({ decisionId: "dec-1", tenantId: "tenant-123", actorId: "actor-789", correlationId: "corr-abc", capability: "classify_lead", decision: "allow", reason: "High confidence", inputHash: "hash-abc" });
      const port = createOrchestratorPort({ request, context, invocation, decision });
      expect(port.request.requestId).toBe("req-1");
      expect(port.context.correlationId).toBe("corr-abc");
      expect(port.invocation.invocationId).toBe("inv-1");
      expect(port.decision.decisionId).toBe("dec-1");
    });
  });

  describe("validateOrchestratorPort", () => {
    it("retorna array vazio para port válido", () => {
      const request = createIntelligenceRequest({ requestId: "req-1", tenantContext: baseTenantContext, actorContext: baseActorContext, capability: "test", input: {} });
      const context = createContextEnvelope({ tenantContext: baseTenantContext, actorContext: baseActorContext });
      const invocation = createCapabilityInvocation({ invocationId: "inv-1", capability: "test", input: {}, actorContext: baseActorContext });
      const decision = createDecisionRecord({ decisionId: "dec-1", tenantId: "t1", actorId: "a1", correlationId: "c1", capability: "test", decision: "allow", reason: "ok", inputHash: "hash" });
      const port = createOrchestratorPort({ request, context, invocation, decision });
      expect(validateOrchestratorPort(port)).toHaveLength(0);
    });
    it("retorna erro quando requestId está vazio", () => {
      const request = { requestId: "", tenantContext: baseTenantContext, actorContext: baseActorContext, capability: "test", input: {}, metadata: {}, timestamp: new Date().toISOString() };
      const context = createContextEnvelope({ tenantContext: baseTenantContext, actorContext: baseActorContext });
      const invocation = createCapabilityInvocation({ invocationId: "inv-1", capability: "test", input: {}, actorContext: baseActorContext });
      const decision = createDecisionRecord({ decisionId: "dec-1", tenantId: "t1", actorId: "a1", correlationId: "c1", capability: "test", decision: "allow", reason: "ok", inputHash: "hash" });
      const port = createOrchestratorPort({ request: request as IntelligenceRequest, context, invocation, decision });
      expect(validateOrchestratorPort(port)).toContain("request.requestId é obrigatório");
    });
  });
});
