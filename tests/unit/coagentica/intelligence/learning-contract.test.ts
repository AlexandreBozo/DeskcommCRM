import { describe, expect, it } from "vitest";
import {
  createActorContext,
  createTenantContext,
} from "@/coagentica/foundation/contracts/tenancy";
import { createIntelligenceRequest, type DecisionRecord } from "@/coagentica/intelligence/contracts";
import { createLearningObservation } from "@/coagentica/intelligence/contracts/learning";

describe("learning contract v0.11", () => {
  it("cria observação sanitizada sem input/output bruto", () => {
    const tenant = createTenantContext({
      tenantId: "tenant-1",
      organizationId: "tenant-1",
      organizationName: "Tenant 1",
      role: "admin",
      visibilityMode: "all",
      locale: "pt-BR",
      timezone: "America/Sao_Paulo",
      isPlatformAdmin: false,
    });
    const actor = createActorContext({ actorId: "actor-1", actorType: "human", tenantContext: tenant });
    const request = createIntelligenceRequest({
      requestId: "req-1", tenantContext: tenant, actorContext: actor,
      capability: "system.runtime.info", input: { secret: "never-expose" },
    });
    const decision: DecisionRecord = {
      decisionId: "req-1-decision", tenantId: "tenant-1", actorId: "actor-1",
      correlationId: "req-1", capability: "system.runtime.info", decision: "allow",
      reason: "ok", inputHash: "h1", outputHash: "h2", timestamp: "2026-09-16T20:00:00.000Z",
      metadata: { planId: "req-1-plan", stepId: "req-1-step-1", planningStrategy: "direct" },
    };
    const obs = createLearningObservation({ request, decision, observedAt: "2026-09-16T20:00:01.000Z" });
    expect(obs).toMatchObject({outcome: "completed", inputHash: "h1", outputHash: "h2", planningStrategy: "direct"});
    const serialized = JSON.stringify(obs);
    expect(serialized).not.toContain("never-expose");
    expect(serialized).not.toMatch(/Prompt|provider|modelId/i);
  });
});
