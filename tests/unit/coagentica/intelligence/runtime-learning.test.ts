import { describe, expect, it, vi } from "vitest";
import { createActorContext, createTenantContext } from "@/coagentica/foundation/contracts/tenancy";
import { createIntelligenceRequest, type DecisionRecord } from "@/coagentica/intelligence/contracts";
import { runIntelligence } from "@/coagentica/intelligence/runtime";

const NOW = "2026-09-16T20:00:00.000Z";

describe("runtime learning v0.11", () => {
  function fixture() {
    const tenant = createTenantContext({
      tenantId: "tenant-1", organizationId: "tenant-1", organizationName: "Tenant",
      role: "admin", visibilityMode: "all", locale: "pt-BR", timezone: "America/Sao_Paulo", isPlatformAdmin: false,
    });
    const actor = createActorContext({ actorId: "actor-1", actorType: "human", tenantContext: tenant });
    const request = createIntelligenceRequest({requestId: "req-1", tenantContext: tenant, actorContext: actor, capability: "system.runtime.info", input: {}});
    const learning = { observe: vi.fn(async () => undefined) };
    const saveDecision = vi.fn(async (r: DecisionRecord) => r);
    const deps = {
      policyGate: { authorize: async () => ({ constraint: {decision: "allow" as const, reason: "ok"} }) },
      operationalContext: {loadOperationalContext: async () => ({})},
      planner: { plan: async () => ({ planId: "req-1-plan", requestId: "req-1", tenantId: "tenant-1", actorId: "actor-1", strategy: "direct" as const, steps: [{stepId: "req-1-step-1", capability: "system.runtime.info", input: {}, metadata: {}}], metadata: {} }) },
      learning,
      executor: { execute: async ({invocation}: any) => ({...invocation, status: "completed" as const, completedAt: NOW, output: {ok: true}}) },
      store: {saveDecision}, hashValue: (v: unknown) => `h:${JSON.stringify(v)}`, now: () => NOW,
    };
    return { request, learning, saveDecision, deps };
  }

  it("observa somente depois do outcome durável", async () => {
    const { request, learning, saveDecision, deps } = fixture();
    const result = await runIntelligence(request, deps as never);
    expect(result.decision.decision).toBe("allow");
    expect(saveDecision).toHaveBeenCalledTimes(2);
    expect(learning.observe).toHaveBeenCalledTimes(1);
    expect(saveDecision.mock.invocationCallOrder[1]!).toBeLessThan(learning.observe.mock.invocationCallOrder[0]!);
  });

  it("falha do learning não invalida o outcome principal", async () => {
    const { request, learning, deps } = fixture();
    learning.observe.mockRejectedValueOnce(new Error("observer fora do ar"));
    await expect(runIntelligence(request, deps as never)).resolves.toMatchObject({decision: {decision: "allow"}});
  });
});
