import { describe, it, expect } from "vitest";
import {
  createIntelligenceRequest,
  createContextEnvelope,
  createCapabilityInvocation,
  createDecisionRecord,
  isDecisionTenantBound,
  validateDecisionRecord,
} from "@/coagentica/intelligence/contracts";
import { createActorContext, createTenantContext } from "@/coagentica/foundation/contracts/tenancy";
import { allow } from "@/coagentica/operations-core/contracts/policy";

const baseTenantParams = { tenantId: "tenant-123", organizationId: "org-456", organizationName: "Test Org", role: "agent" as const, visibilityMode: "own_and_unassigned" as const, locale: "pt-BR", timezone: "America/Sao_Paulo", isPlatformAdmin: false };
const baseTenantContext = createTenantContext(baseTenantParams);
const baseActorContext = createActorContext({ actorId: "actor-789", actorType: "human", tenantContext: baseTenantContext, correlationId: "corr-abc" });
const basePolicyDecision = allow({ reason: "Authorized", tenantId: "tenant-123", actorId: "actor-789", correlationId: "corr-abc" });

describe("coagentica/intelligence/contracts", () => {
  describe("createIntelligenceRequest", () => {
    it("cria IntelligenceRequest válido", () => {
      const request = createIntelligenceRequest({ requestId: "req-1", tenantContext: baseTenantContext, actorContext: baseActorContext, capability: "classify_lead", input: { message: "Hello" }, policyDecision: basePolicyDecision, metadata: { source: "test" } });
      expect(request.requestId).toBe("req-1");
      expect(request.capability).toBe("classify_lead");
      expect(request.policyDecision).toBe(basePolicyDecision);
    });
    it("lança erro quando requestId está vazio", () => {
      expect(() => createIntelligenceRequest({ requestId: "", tenantContext: baseTenantContext, actorContext: baseActorContext, capability: "test", input: {} })).toThrow("requestId é obrigatório");
    });
  });

  describe("createContextEnvelope", () => {
    it("cria ContextEnvelope com todos os campos", () => {
      const envelope = createContextEnvelope({ tenantContext: baseTenantContext, actorContext: baseActorContext, conversationId: "conv-1", leadId: "lead-2", contactId: "contact-3", additionalContext: { custom: "data" } });
      expect(envelope.conversationId).toBe("conv-1");
      expect(envelope.correlationId).toBe("corr-abc");
    });
  });

  describe("createCapabilityInvocation", () => {
    it("cria CapabilityInvocation com status pending", () => {
      const invocation = createCapabilityInvocation({ invocationId: "inv-1", capability: "send_message", input: { to: "5511999999999", body: "Hello" }, actorContext: baseActorContext, metadata: { channel: "whatsapp" } });
      expect(invocation.invocationId).toBe("inv-1");
      expect(invocation.status).toBe("pending");
    });
    it("lança erro quando invocationId está vazio", () => {
      expect(() => createCapabilityInvocation({ invocationId: "", capability: "test", input: {}, actorContext: baseActorContext })).toThrow("invocationId é obrigatório");
    });
  });

  describe("createDecisionRecord", () => {
    it("cria DecisionRecord válido", () => {
      const record = createDecisionRecord({ decisionId: "dec-1", tenantId: "tenant-123", actorId: "actor-789", correlationId: "corr-abc", capability: "classify_lead", decision: "allow", reason: "High confidence", inputHash: "hash-abc", outputHash: "hash-xyz", policyDecision: basePolicyDecision, metadata: { model: "gpt-4" } });
      expect(record.decisionId).toBe("dec-1");
      expect(record.decision).toBe("allow");
    });
    it("lança erro para campos obrigatórios ausentes", () => {
      expect(() => createDecisionRecord({ decisionId: "", tenantId: "t1", actorId: "a1", correlationId: "c1", capability: "test", decision: "allow", reason: "ok", inputHash: "hash" })).toThrow("decisionId é obrigatório");
    });
  });

  describe("isDecisionTenantBound", () => {
    it("retorna true quando tenantId bate", () => {
      const record = createDecisionRecord({ decisionId: "d1", tenantId: "tenant-123", actorId: "a1", correlationId: "c1", capability: "test", decision: "allow", reason: "ok", inputHash: "hash" });
      expect(isDecisionTenantBound(record, "tenant-123")).toBe(true);
    });
    it("retorna false quando tenantId difere", () => {
      const record = createDecisionRecord({ decisionId: "d1", tenantId: "tenant-123", actorId: "a1", correlationId: "c1", capability: "test", decision: "allow", reason: "ok", inputHash: "hash" });
      expect(isDecisionTenantBound(record, "other-tenant")).toBe(false);
    });
  });

  describe("validateDecisionRecord", () => {
    it("retorna array vazio para record válido", () => {
      const record = createDecisionRecord({ decisionId: "d1", tenantId: "t1", actorId: "a1", correlationId: "c1", capability: "test", decision: "allow", reason: "ok", inputHash: "hash" });
      expect(validateDecisionRecord(record)).toHaveLength(0);
    });
  });
});
