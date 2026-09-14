import { describe, expect, it } from "vitest";
import { createActorContext, createTenantContext } from "@/coagentica/foundation/contracts/tenancy";
import { createIntelligenceRequest } from "@/coagentica/intelligence/contracts";
import { createDefaultIntelligencePolicyGate } from "@/coagentica/intelligence/adapters/default-policy-gate";

function request(capability: string, role: "viewer" | "agent" | "ai_operator" | "manager" | "admin" = "viewer") {
  const tenantContext = createTenantContext({
    tenantId: "tenant-1",
    organizationId: "tenant-1",
    organizationName: "Tenant",
    role,
    visibilityMode: "all",
    locale: "pt-BR",
    timezone: "America/Sao_Paulo",
    isPlatformAdmin: false,
  });
  const actorContext = createActorContext({
    actorId: "11111111-1111-4111-8111-111111111111",
    actorType: "human",
    tenantContext,
    correlationId: "corr-1",
  });
  return createIntelligenceRequest({
    requestId: "req-1",
    tenantContext,
    actorContext,
    capability,
    input: {},
  });
}

describe("default intelligence policy gate", () => {
  it("nega capability não cadastrada", async () => {
    const result = await createDefaultIntelligencePolicyGate().authorize(request("unknown"));
    expect(result.constraint.decision).toBe("deny");
  });

  it("autoriza runtime info sem carregar contexto", async () => {
    const result = await createDefaultIntelligencePolicyGate().authorize(request("system.runtime.info"));
    expect(result.constraint.decision).toBe("allow");
    expect(result.selection).toBeUndefined();
  });

  it("context summary autoriza somente seleção limitada", async () => {
    const result = await createDefaultIntelligencePolicyGate().authorize(request("tenant.context.summary"));
    expect(result.constraint.decision).toBe("allow");
    expect(result.selection).toMatchObject({
      includeEntities: true,
      includeMemoryEntries: true,
      includeCapabilities: true,
    });
    expect(result.limits?.maxEntities).toBe(50);
    expect(result.limits?.maxMemoryEntries).toBe(20);
  });
});
