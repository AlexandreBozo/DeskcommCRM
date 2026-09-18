import { describe, expect, it } from "vitest";
import { createActorContext, createTenantContext } from "@/coagentica/foundation/contracts/tenancy";
import { createIntelligenceRequest } from "@/coagentica/intelligence/contracts";
import { createContextEngineBudget } from "@/coagentica/intelligence/contracts/context-engine";
import { createBoundedContextEngine } from "@/coagentica/intelligence/adapters/bounded-context-engine";

const NOW = "2026-09-18T12:00:00.000Z";

function request(tenantId = "tenant-1") {
  const tenantContext = createTenantContext({
    tenantId,
    organizationId: tenantId,
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
    requestId: "req-context",
    tenantContext,
    actorContext,
    capability: "tenant.context.summary",
    input: { query: "premium sales" },
    metadata: {},
  });
}

function context(tenantId = "tenant-1") {
  return {
    tenantId,
    organizationId: tenantId,
    sourceVersion: 1,
    snapshotAt: NOW,
    entities: [
      { entityId: "e-1", entityKind: "contact", version: 1, data: { segment: "premium" }, updatedAt: NOW, source: "test" },
      { entityId: "e-2", entityKind: "contact", version: 1, data: { segment: "basic" }, updatedAt: NOW, source: "test" },
    ],
    relationships: [],
    knowledgeSources: [
      { sourceId: "k-1", name: "Premium sales playbook", type: "document", status: "active", metadata: {} },
      { sourceId: "k-2", name: "Old", type: "document", status: "inactive", metadata: {} },
    ],
    memoryEntries: [
      { entryId: "m-1", type: "fact", content: "premium customer", status: "active", metadata: {} },
      { entryId: "m-2", type: "fact", content: "archived", status: "archived", metadata: {} },
    ],
    goals: [
      { goalId: "g-1", name: "Premium sales growth", description: "sales", status: "active", metadata: {} },
      { goalId: "g-2", name: "Draft", description: "", status: "draft", metadata: {} },
    ],
    capabilities: [
      { capabilityId: "tenant.context.summary", name: "tenant.context.summary", type: "tool", status: "available", config: {}, metadata: {} },
      { capabilityId: "disabled", name: "disabled", type: "tool", status: "unavailable", config: {}, metadata: {} },
    ],
    truncated: {
      entities: false,
      relationships: false,
      knowledgeSources: false,
      memoryEntries: false,
      goals: false,
      capabilities: false,
    },
  } as const;
}

describe("context engine v0.15", () => {
  it("seleciona contexto relevante, ativo e bounded", async () => {
    const engine = createBoundedContextEngine(createContextEngineBudget({
      maxEntities: 1,
      maxRelationships: 0,
      maxKnowledgeSources: 1,
      maxMemoryEntries: 1,
      maxGoals: 1,
      maxCapabilities: 1,
    }));

    const result = await engine.prepare({ request: request(), context: context() as any });

    expect(engine.status().version).toBe("v0.15");
    expect(result.context?.entities).toHaveLength(1);
    expect(result.context?.entities[0]?.entityId).toBe("e-1");
    expect(result.context?.knowledgeSources.map((item) => item.sourceId)).toEqual(["k-1"]);
    expect(result.context?.memoryEntries.map((item) => item.entryId)).toEqual(["m-1"]);
    expect(result.context?.goals.map((item) => item.goalId)).toEqual(["g-1"]);
    expect(result.context?.capabilities.map((item) => item.capabilityId)).toEqual(["tenant.context.summary"]);
    expect(result.truncated).toBe(true);
  });

  it("rejeita contexto de outro tenant", async () => {
    const engine = createBoundedContextEngine();
    await expect(
      engine.prepare({ request: request("tenant-1"), context: context("tenant-2") as any })
    ).rejects.toThrow("outro tenant");
  });

  it("preserva null sem inventar contexto", async () => {
    const result = await createBoundedContextEngine().prepare({ request: request(), context: null });
    expect(result.context).toBeNull();
    expect(result.truncated).toBe(false);
  });
});
