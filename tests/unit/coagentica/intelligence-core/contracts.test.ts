import { describe, it, expect } from "vitest";
import {
  createIntelligenceRequest,
  createContextEnvelope,
  createCapabilityInvocation,
  createDecisionRecord,
  isDecisionTenantBound,
  validateDecisionRecord,
  type DecisionRecord,
} from "@/coagentica/intelligence-core/contracts";
import { createActorContext, createTenantContext } from "@/coagentica/foundation/contracts/tenancy";
import { allow } from "@/coagentica/business-engine/contracts/policy";

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

const baseTenantContext = createTenantContext(baseTenantParams);
const baseActorContext = createActorContext({
  actorId: "actor-789",
  actorType: "human",
  tenantContext: baseTenantContext,
  correlationId: "corr-abc",
});

const basePolicyDecision = allow({
  reason: "Authorized",
  tenantId: "tenant-123",
  actorId: "actor-789",
  correlationId: "corr-abc",
});

describe("coagentica/intelligence-core/contracts", () => {
  describe("createIntelligenceRequest", () => {
    it("cria IntelligenceRequest válido", () => {
      const request = createIntelligenceRequest({
        requestId: "req-1",
        tenantContext: baseTenantContext,
        actorContext: baseActorContext,
        capability: "classify_lead",
        input: { message: "Hello" },
        policyDecision: basePolicyDecision,
        metadata: { source: "test" },
      });
      expect(request.requestId).toBe("req-1");
      expect(request.capability).toBe("classify_lead");
      expect(request.input).toEqual({ message: "Hello" });
      expect(request.policyDecision).toBe(basePolicyDecision);
      expect(request.metadata).toEqual({ source: "test" });
      expect(request.timestamp).toBeDefined();
    });

    it("usa metadata vazia como padrão", () => {
      const request = createIntelligenceRequest({
        requestId: "req-1",
        tenantContext: baseTenantContext,
        actorContext: baseActorContext,
        capability: "test",
        input: {},
      });
      expect(request.metadata).toEqual({});
    });

    it("lança erro quando requestId está vazio", () => {
      expect(() =>
        createIntelligenceRequest({
          requestId: "",
          tenantContext: baseTenantContext,
          actorContext: baseActorContext,
          capability: "test",
          input: {},
        })
      ).toThrow("requestId é obrigatório");
    });

    it("lança erro quando capability está vazio", () => {
      expect(() =>
        createIntelligenceRequest({
          requestId: "req-1",
          tenantContext: baseTenantContext,
          actorContext: baseActorContext,
          capability: "",
          input: {},
        })
      ).toThrow("capability é obrigatório");
    });

    it("não muta input original", () => {
      const input = { message: "Hello" };
      createIntelligenceRequest({
        requestId: "req-1",
        tenantContext: baseTenantContext,
        actorContext: baseActorContext,
        capability: "test",
        input,
      });
      expect(input).toEqual({ message: "Hello" });
    });
  });

  describe("createContextEnvelope", () => {
    it("cria ContextEnvelope com todos os campos", () => {
      const envelope = createContextEnvelope({
        tenantContext: baseTenantContext,
        actorContext: baseActorContext,
        conversationId: "conv-1",
        leadId: "lead-2",
        contactId: "contact-3",
        additionalContext: { custom: "data" },
      });
      expect(envelope.tenantContext).toBe(baseTenantContext);
      expect(envelope.actorContext).toBe(baseActorContext);
      expect(envelope.conversationId).toBe("conv-1");
      expect(envelope.leadId).toBe("lead-2");
      expect(envelope.contactId).toBe("contact-3");
      expect(envelope.additionalContext).toEqual({ custom: "data" });
      expect(envelope.correlationId).toBe("corr-abc");
    });

    it("usa campos opcionais como undefined quando não fornecidos", () => {
      const envelope = createContextEnvelope({
        tenantContext: baseTenantContext,
        actorContext: baseActorContext,
      });
      expect(envelope.conversationId).toBeUndefined();
      expect(envelope.leadId).toBeUndefined();
      expect(envelope.contactId).toBeUndefined();
      expect(envelope.additionalContext).toEqual({});
    });
  });

  describe("createCapabilityInvocation", () => {
    it("cria CapabilityInvocation com status pending", () => {
      const invocation = createCapabilityInvocation({
        invocationId: "inv-1",
        capability: "send_message",
        input: { to: "5511999999999", body: "Hello" },
        actorContext: baseActorContext,
        metadata: { channel: "whatsapp" },
      });
      expect(invocation.invocationId).toBe("inv-1");
      expect(invocation.capability).toBe("send_message");
      expect(invocation.input).toEqual({ to: "5511999999999", body: "Hello" });
      expect(invocation.status).toBe("pending");
      expect(invocation.startedAt).toBeDefined();
      expect(invocation.completedAt).toBeUndefined();
      expect(invocation.error).toBeUndefined();
      expect(invocation.metadata).toEqual({ channel: "whatsapp" });
      expect(invocation.actorContext).toBe(baseActorContext);
    });

    it("usa metadata vazia como padrão", () => {
      const invocation = createCapabilityInvocation({
        invocationId: "inv-1",
        capability: "test",
        input: {},
        actorContext: baseActorContext,
      });
      expect(invocation.metadata).toEqual({});
    });

    it("lança erro quando invocationId está vazio", () => {
      expect(() =>
        createCapabilityInvocation({
          invocationId: "",
          capability: "test",
          input: {},
          actorContext: baseActorContext,
        })
      ).toThrow("invocationId é obrigatório");
    });

    it("lança erro quando capability está vazio", () => {
      expect(() =>
        createCapabilityInvocation({
          invocationId: "inv-1",
          capability: "",
          input: {},
          actorContext: baseActorContext,
        })
      ).toThrow("capability é obrigatório");
    });
  });

  describe("createDecisionRecord", () => {
    it("cria DecisionRecord válido", () => {
      const record = createDecisionRecord({
        decisionId: "dec-1",
        tenantId: "tenant-123",
        actorId: "actor-789",
        correlationId: "corr-abc",
        capability: "classify_lead",
        decision: "allow",
        reason: "High confidence",
        inputHash: "hash-abc",
        outputHash: "hash-xyz",
        policyDecision: basePolicyDecision,
        metadata: { model: "gpt-4" },
      });
      expect(record.decisionId).toBe("dec-1");
      expect(record.tenantId).toBe("tenant-123");
      expect(record.actorId).toBe("actor-789");
      expect(record.correlationId).toBe("corr-abc");
      expect(record.capability).toBe("classify_lead");
      expect(record.decision).toBe("allow");
      expect(record.reason).toBe("High confidence");
      expect(record.inputHash).toBe("hash-abc");
      expect(record.outputHash).toBe("hash-xyz");
      expect(record.policyDecision).toBe(basePolicyDecision);
      expect(record.metadata).toEqual({ model: "gpt-4" });
      expect(record.timestamp).toBeDefined();
    });

    it("permite outputHash opcional", () => {
      const record = createDecisionRecord({
        decisionId: "dec-1",
        tenantId: "t1",
        actorId: "a1",
        correlationId: "c1",
        capability: "test",
        decision: "deny",
        reason: "Blocked",
        inputHash: "hash-1",
      });
      expect(record.outputHash).toBeUndefined();
    });

    it("lança erro para campos obrigatórios ausentes", () => {
      expect(() =>
        createDecisionRecord({
          decisionId: "",
          tenantId: "t1",
          actorId: "a1",
          correlationId: "c1",
          capability: "test",
          decision: "allow",
          reason: "ok",
          inputHash: "hash",
        })
      ).toThrow("decisionId é obrigatório");

      expect(() =>
        createDecisionRecord({
          decisionId: "d1",
          tenantId: "",
          actorId: "a1",
          correlationId: "c1",
          capability: "test",
          decision: "allow",
          reason: "ok",
          inputHash: "hash",
        })
      ).toThrow("tenantId é obrigatório");

      expect(() =>
        createDecisionRecord({
          decisionId: "d1",
          tenantId: "t1",
          actorId: "",
          correlationId: "c1",
          capability: "test",
          decision: "allow",
          reason: "ok",
          inputHash: "hash",
        })
      ).toThrow("actorId é obrigatório");
    });
  });

  describe("isDecisionTenantBound", () => {
    it("retorna true quando tenantId bate", () => {
      const record = createDecisionRecord({
        decisionId: "d1",
        tenantId: "tenant-123",
        actorId: "a1",
        correlationId: "c1",
        capability: "test",
        decision: "allow",
        reason: "ok",
        inputHash: "hash",
      });
      expect(isDecisionTenantBound(record, "tenant-123")).toBe(true);
    });

    it("retorna false quando tenantId difere", () => {
      const record = createDecisionRecord({
        decisionId: "d1",
        tenantId: "tenant-123",
        actorId: "a1",
        correlationId: "c1",
        capability: "test",
        decision: "allow",
        reason: "ok",
        inputHash: "hash",
      });
      expect(isDecisionTenantBound(record, "other-tenant")).toBe(false);
    });
  });

  describe("validateDecisionRecord", () => {
    it("retorna array vazio para record válido", () => {
      const record = createDecisionRecord({
        decisionId: "d1",
        tenantId: "t1",
        actorId: "a1",
        correlationId: "c1",
        capability: "test",
        decision: "allow",
        reason: "ok",
        inputHash: "hash",
      });
      expect(validateDecisionRecord(record)).toHaveLength(0);
    });

    it("retorna erros para campos obrigatórios ausentes", () => {
      const record: DecisionRecord = {
        decisionId: "",
        tenantId: "",
        actorId: "",
        correlationId: "",
        capability: "",
        decision: "invalid" as "allow" | "deny" | "defer" | "escalate",
        reason: "",
        inputHash: "",
        timestamp: "",
        metadata: {},
      };
      const errors = validateDecisionRecord(record);
      expect(errors).toContain("decisionId é obrigatório");
      expect(errors).toContain("tenantId é obrigatório");
      expect(errors).toContain("actorId é obrigatório");
      expect(errors).toContain("correlationId é obrigatório");
      expect(errors).toContain("capability é obrigatório");
      expect(errors).toContain("decision inválida: invalid");
      expect(errors).toContain("reason é obrigatório");
      expect(errors).toContain("inputHash é obrigatório");
    });
  });
});
