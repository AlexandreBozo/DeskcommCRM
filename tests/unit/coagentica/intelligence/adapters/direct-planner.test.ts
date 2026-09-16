import { describe, expect, it } from "vitest";
import {
  createActorContext,
  createTenantContext,
} from "@/coagentica/foundation/contracts/tenancy";
import { createIntelligenceRequest } from "@/coagentica/intelligence/contracts";
import { createDirectPlanner } from "@/coagentica/intelligence/adapters/direct-planner";

function makeRequest() {
  const tenantContext = createTenantContext({
    tenantId: "tenant-1",
    organizationId: "tenant-1",
    organizationName: "Tenant 1",
    role: "viewer",
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
    requestId: "req-plan",
    tenantContext,
    actorContext,
    capability: "tenant.context.summary",
    input: { include: "summary" },
  });
}

describe("Direct Planner v0.9", () => {
  it("produz plano determinístico de um único passo equivalente ao request", async () => {
    const request = makeRequest();
    const planner = createDirectPlanner();

    const first = await planner.plan({ request, context: null });
    const second = await planner.plan({ request, context: null });

    expect(first).toEqual(second);
    expect(first).toMatchObject({
      planId: "req-plan-plan",
      requestId: "req-plan",
      tenantId: "tenant-1",
      actorId: "11111111-1111-4111-8111-111111111111",
      strategy: "direct",
      metadata: { version: "v0.9" },
    });
    expect(first.steps).toHaveLength(1);
    expect(first.steps[0]).toMatchObject({
      stepId: "req-plan-step-1",
      capability: "tenant.context.summary",
      input: { include: "summary" },
    });
  });
});
