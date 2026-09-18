import { describe, expect, it } from "vitest";
import { createActorContext, createTenantContext } from "@/coagentica/foundation/contracts/tenancy";
import { createIntelligenceRequest } from "@/coagentica/intelligence/contracts";
import { validateExecutionPlan } from "@/coagentica/intelligence/contracts/planning";
import { createGoalAwarePlanner } from "@/coagentica/intelligence/adapters/direct-planner";

function request() {
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
  const actorContext = createActorContext({
    actorId: "actor-1",
    actorType: "human",
    tenantContext,
  });
  return createIntelligenceRequest({
    requestId: "req-plan",
    tenantContext,
    actorContext,
    capability: "system.runtime.info",
    input: { source: "test" },
    metadata: {},
  });
}

function context(goals: any[] = []) {
  return {
    tenantId: "tenant-1",
    organizationId: "tenant-1",
    sourceVersion: 1,
    snapshotAt: "2026-09-18T12:00:00.000Z",
    entities: [],
    relationships: [],
    knowledgeSources: [],
    memoryEntries: [],
    goals,
    capabilities: [
      { capabilityId: "system.runtime.info", name: "system.runtime.info", type: "tool", status: "available", config: {}, metadata: {} },
      { capabilityId: "tenant.goals.list", name: "tenant.goals.list", type: "tool", status: "available", config: {}, metadata: {} },
    ],
    truncated: { entities: false, relationships: false, knowledgeSources: false, memoryEntries: false, goals: false, capabilities: false },
  } as any;
}

describe("goal-aware planning v0.14/v0.16", () => {
  it("mantém direct quando não existem goals ativos", async () => {
    const req = request();
    const plan = await createGoalAwarePlanner().plan({ request: req, context: context() });
    expect(plan.strategy).toBe("direct");
    expect(plan.steps).toHaveLength(1);
    expect(plan.metadata.version).toBe("v0.9");
    expect(validateExecutionPlan(plan, req)).toEqual([]);
  });

  it("ancora o plano em goal ativo", async () => {
    const req = request();
    const plan = await createGoalAwarePlanner().plan({
      request: req,
      context: context([{ goalId: "goal-1", name: "Crescer", description: "", status: "active", metadata: {} }]),
    });
    expect(plan.strategy).toBe("goal-aware");
    expect(plan.metadata).toMatchObject({ version: "v0.14", primaryGoalId: "goal-1" });
    expect(plan.steps[0]?.metadata).toMatchObject({ goalId: "goal-1" });
  });

  it("cria multi-step somente com capabilities explicitamente declaradas e disponíveis", async () => {
    const req = request();
    const plan = await createGoalAwarePlanner().plan({
      request: req,
      context: context([{
        goalId: "goal-1",
        name: "Inspecionar runtime e goals",
        description: "",
        status: "active",
        metadata: { capabilitySequence: ["tenant.goals.list", "capability.inexistente"] },
      }]),
    });
    expect(plan.strategy).toBe("goal-aware-multi-step");
    expect(plan.steps.map((step) => step.capability)).toEqual(["system.runtime.info", "tenant.goals.list"]);
    expect(plan.metadata.version).toBe("v0.16");
    expect(validateExecutionPlan(plan, req)).toEqual([]);
  });
});
