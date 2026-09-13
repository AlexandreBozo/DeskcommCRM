import { describe, it, expect } from "vitest";
import {
  createTenantOperationsCore,
  addPermission,
  addWorkflowRun,
  addPolicyDecision,
  addEventEnvelope,
  isTenantBoundToCore,
  validateTenantOperationsCore,
  type TenantOperationsCore,
  type PermissionCheck,
} from "@/coagentica/operations-core/contracts/tenant-operations-core";
import type { ActorContext } from "@/coagentica/foundation/contracts/tenancy";
import type { WorkflowRun, PolicyDecision } from "@/coagentica/operations-core/contracts";
import type { EventEnvelope } from "@/coagentica/operations-core/contracts/domain-event";
import { createTenantContext } from "@/coagentica/foundation/contracts/tenancy";

const baseTenantParams = { tenantId: "t1", organizationId: "org", organizationName: "Test Org", role: "agent" as const, visibilityMode: "own_and_unassigned" as const, locale: "pt-BR", timezone: "America/Sao_Paulo", isPlatformAdmin: false };

describe("coagentica/operations-core/contracts/tenant-operations-core", () => {
  describe("createTenantOperationsCore", () => {
    it("cria TenantOperationsCore válido", () => {
      const core = createTenantOperationsCore({
        tenantId: "tenant-123",
        organizationId: "org-456",
        actorContext: { actorId: "actor-789", actorType: "human", tenantId: "tenant-123", role: "agent", isPlatformAdmin: false },
      });
      expect(core.tenantId).toBe("tenant-123");
      expect(core.organizationId).toBe("org-456");
      expect(core.permissions).toEqual([]);
      expect(core.activeWorkflows).toEqual([]);
    });
    it("lança erro quando tenantId está vazio", () => {
      expect(() => createTenantOperationsCore({ tenantId: "", organizationId: "org", actorContext: { actorId: "a", actorType: "human", tenantId: "", role: "agent", isPlatformAdmin: false } })).toThrow("tenantId é obrigatório");
    });
  });

  describe("addPermission", () => {
    it("adiciona permissão ao core", () => {
      const core = createTenantOperationsCore({ tenantId: "t1", organizationId: "org", actorContext: { actorId: "a", actorType: "human", tenantId: "t1", role: "agent", isPlatformAdmin: false } });
      const check: PermissionCheck = { resource: "lead", action: "read", decision: "allow", reason: "ok" };
      const updated = addPermission(core, check);
      expect(updated.permissions).toHaveLength(1);
    });
  });

  describe("addWorkflowRun", () => {
    it("adiciona workflow run ao core", () => {
      const core = createTenantOperationsCore({ tenantId: "t1", organizationId: "org", actorContext: { actorId: "a", actorType: "human", tenantId: "t1", role: "agent", isPlatformAdmin: false } });
      const baseActorContextForWorkflow: ActorContext = { actorId: "a", actorType: "human", tenantId: "t1", role: "agent", isPlatformAdmin: false, tenantContext: createTenantContext(baseTenantParams) };
      const run: WorkflowRun = { runId: "run-1", workflowId: "wf-1", workflowVersion: 1, tenantId: "t1", actorContext: baseActorContextForWorkflow, status: "pending", currentNodeId: null, variables: {}, startedAt: "", updatedAt: "", completedAt: null, metadata: {} };
      const updated = addWorkflowRun(core, run);
      expect(updated.activeWorkflows).toHaveLength(1);
    });
  });

  describe("addPolicyDecision", () => {
    it("adiciona policy decision ao core", () => {
      const core = createTenantOperationsCore({ tenantId: "t1", organizationId: "org", actorContext: { actorId: "a", actorType: "human", tenantId: "t1", role: "agent", isPlatformAdmin: false } });
      const decision: PolicyDecision = { decision: "allow", reason: "ok", tenantId: "t1", actorId: "a", correlationId: "c1" };
      const updated = addPolicyDecision(core, decision);
      expect(updated.policyDecisions).toHaveLength(1);
    });
  });

  describe("addEventEnvelope", () => {
    it("adiciona event envelope ao core", () => {
      const core = createTenantOperationsCore({ tenantId: "t1", organizationId: "org", actorContext: { actorId: "a", actorType: "human", tenantId: "t1", role: "agent", isPlatformAdmin: false } });
      const envelope: EventEnvelope = { event: { eventType: "test", entityKind: "test", entityId: null, payload: {}, metadata: {}, occurredAt: "", correlationId: "c1" }, tenantContext: { tenantId: "t1", organizationId: "org", organizationName: "", role: "agent", visibilityMode: "own", locale: "", timezone: "UTC", isPlatformAdmin: false }, envelopeId: "e1", receivedAt: "" };
      const updated = addEventEnvelope(core, envelope);
      expect(updated.eventLog).toHaveLength(1);
    });
  });

  describe("isTenantBoundToCore", () => {
    it("retorna true quando tenantId bate", () => {
      const core = createTenantOperationsCore({ tenantId: "t1", organizationId: "org", actorContext: { actorId: "a", actorType: "human", tenantId: "t1", role: "agent", isPlatformAdmin: false } });
      expect(isTenantBoundToCore(core, "t1")).toBe(true);
    });
    it("retorna false quando tenantId difere", () => {
      const core = createTenantOperationsCore({ tenantId: "t1", organizationId: "org", actorContext: { actorId: "a", actorType: "human", tenantId: "t1", role: "agent", isPlatformAdmin: false } });
      expect(isTenantBoundToCore(core, "t2")).toBe(false);
    });
  });

  describe("validateTenantOperationsCore", () => {
    it("retorna array vazio para core válido", () => {
      const core = createTenantOperationsCore({ tenantId: "t1", organizationId: "org", actorContext: { actorId: "a", actorType: "human", tenantId: "t1", role: "agent", isPlatformAdmin: false } });
      expect(validateTenantOperationsCore(core)).toHaveLength(0);
    });
    it("retorna erros para core com campos obrigatórios ausentes", () => {
      const core: TenantOperationsCore = {
        tenantId: "",
        organizationId: "",
        actorContext: { actorId: "", actorType: "human", tenantId: "", role: "agent", isPlatformAdmin: false },
        permissions: [],
        activeWorkflows: [],
        publishedDefinitions: [],
        eventLog: [],
        policyDecisions: [],
      };
      const errors = validateTenantOperationsCore(core);
      expect(errors).toContain("tenantId é obrigatório");
      expect(errors).toContain("organizationId é obrigatório");
      expect(errors).toContain("actorContext.actorId é obrigatório");
    });
  });
});
