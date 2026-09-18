import { describe, expect, it } from "vitest";
import { createActorContext, createTenantContext } from "@/coagentica/foundation/contracts/tenancy";
import { createIntelligenceRequest } from "@/coagentica/intelligence/contracts";
import { createNativeActionDescriptor } from "@/coagentica/intelligence/contracts/native-action";
import { createDefaultGovernanceGate } from "@/coagentica/intelligence/adapters/default-governance-gate";

function req(metadata: Record<string, unknown> = {}) {
  const tenantContext = createTenantContext({
    tenantId: "tenant-1",
    organizationId: "tenant-1",
    organizationName: "Tenant",
    role: "admin",
    visibilityMode: "all",
    locale: "pt-BR",
    timezone: "America/Sao_Paulo",
    isPlatformAdmin: false,
  });
  const actorContext = createActorContext({ actorId: "actor-1", actorType: "human", tenantContext });
  return createIntelligenceRequest({
    requestId: "req-governance",
    tenantContext,
    actorContext,
    capability: "external.write",
    input: {},
    metadata,
  });
}

const step = { stepId: "step-1", capability: "external.write", input: {}, metadata: {} };

describe("governance v0.19", () => {
  it("permite handlers sem side effect declarado como read-only", async () => {
    const gate = createDefaultGovernanceGate([
      { capability: "read.info", execute: async () => { throw new Error("não executa no teste"); } },
    ]);
    const result = await gate.assess({ request: { ...req(), capability: "read.info" } as any, step: { ...step, capability: "read.info" }, context: null });
    expect(result.decision).toBe("allow");
  });

  it("nega mutação sem idempotencyKey", async () => {
    const gate = createDefaultGovernanceGate([
      {
        capability: "external.write",
        action: createNativeActionDescriptor({ sideEffect: "local_write", requiresApproval: false }),
        execute: async () => { throw new Error("não executa no teste"); },
      },
    ]);
    const result = await gate.assess({ request: req(), step, context: null });
    expect(result.decision).toBe("deny");
    expect(result.reason).toContain("idempotencyKey");
  });

  it("exige aprovação humana para side effect externo", async () => {
    const gate = createDefaultGovernanceGate([
      {
        capability: "external.write",
        action: createNativeActionDescriptor({ sideEffect: "external_write" }),
        execute: async () => { throw new Error("não executa no teste"); },
      },
    ]);
    const result = await gate.assess({
      request: req({ idempotencyKey: "idem-1" }),
      step,
      context: null,
    });
    expect(result.decision).toBe("approval_required");
  });

  it("aceita aprovação humana vinculada ao mesmo request, tenant e capability", async () => {
    const gate = createDefaultGovernanceGate([
      {
        capability: "external.write",
        action: createNativeActionDescriptor({ sideEffect: "external_write" }),
        execute: async () => { throw new Error("não executa no teste"); },
      },
    ]);
    const result = await gate.assess({
      request: req({
        idempotencyKey: "idem-1",
        approval: {
          approvalId: "approval-1",
          requestId: "req-governance",
          tenantId: "tenant-1",
          capability: "external.write",
          approvedBy: "human-1",
          approvedAt: "2026-09-18T12:00:00.000Z",
        },
      }),
      step,
      context: null,
    });
    expect(result.decision).toBe("allow");
    expect(result.approvalId).toBe("approval-1");
  });
});
