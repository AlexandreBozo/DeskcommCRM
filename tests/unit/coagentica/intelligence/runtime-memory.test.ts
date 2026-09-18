import { describe, expect, it, vi } from "vitest";
import {
  createActorContext,
  createTenantContext,
} from "@/coagentica/foundation/contracts/tenancy";
import {
  createIntelligenceRequest,
  type DecisionRecord,
} from "@/coagentica/intelligence/contracts";
import { runIntelligence } from "@/coagentica/intelligence/runtime";

const NOW = "2026-09-16T00:00:00.000Z";

describe("runtime memory v0.12", () => {
  it("faz defer antes do write-head, planning e executor quando memory falha", async () => {
    const tenantContext = createTenantContext({
      tenantId: "tenant-1",
      organizationId: "tenant-1",
      organizationName: "Tenant",
      role: "viewer",
      visibilityMode: "all",
      locale: "pt-BR",
      timezone: "America/Sao_Paulo",
      isPlatformAdmin: false,
    });
    const actorContext = createActorContext({
      actorId: "actor-1",
      actorType: "human",
      tenantContext,
      correlationId: "corr-1",
    });
    const request = createIntelligenceRequest({
      requestId: "req-memory-fail",
      tenantContext,
      actorContext,
      capability: "tenant.context.summary",
      input: {},
    });

    const context = {
      tenantId: "tenant-1",
      organizationId: "tenant-1",
      sourceVersion: 1,
      snapshotAt: NOW,
      entities: [],
      relationships: [],
      knowledgeSources: [],
      memoryEntries: [],
      goals: [],
      capabilities: [],
      truncated: {
        entities: false,
        relationships: false,
        knowledgeSources: false,
        memoryEntries: false,
        goals: false,
        capabilities: false,
      },
    };

    const planner = { plan: vi.fn() };
    const executor = { execute: vi.fn() };
    const store = {
      saveDecision: vi.fn(async (record: DecisionRecord) => record),
    };
    const learning = { observe: vi.fn(async () => undefined) };

    const result = await runIntelligence(request, {
      policyGate: {
        authorize: async () => ({
          constraint: { decision: "allow", reason: "ok" },
          selection: { includeMemoryEntries: true },
        }),
      },
      operationalContext: {
        loadOperationalContext: async () => context,
      },
      planner,
      memory: {
        budget: { maxEntries: 20 },
        status: {
          version: "v0.12",
          mode: "read-only",
          writesEnabled: false,
          budget: { maxEntries: 20 },
        },
        prepare: vi.fn(async () => {
          throw new Error("memory indisponível");
        }),
      },
      contextEngine: {
        status: () => ({
          version: "v0.15",
          mode: "bounded-relevance",
          budget: {
            maxEntities: 20,
            maxRelationships: 30,
            maxKnowledgeSources: 8,
            maxMemoryEntries: 12,
            maxGoals: 5,
            maxCapabilities: 20,
          },
        }),
        prepare: vi.fn(async ({ context }) => ({
          context,
          selected: {
            entities: 0,
            relationships: 0,
            knowledgeSources: 0,
            memoryEntries: 0,
            goals: 0,
            capabilities: 0,
          },
          truncated: false,
          status: {
            version: "v0.15",
            mode: "bounded-relevance",
            budget: {
              maxEntities: 20,
              maxRelationships: 30,
              maxKnowledgeSources: 8,
              maxMemoryEntries: 12,
              maxGoals: 5,
              maxCapabilities: 20,
            },
          },
        })),
      },
      governance: {
        status: () => ({ version: "v0.19" as const, mode: "human-in-the-loop" as const }),
        assess: vi.fn(async ({ step }) => ({
          version: "v0.19" as const,
          decision: "allow" as const,
          reason: "read-only permitido",
          action: {
            capability: step.capability,
            sideEffect: "none" as const,
            idempotency: "none" as const,
            requiresApproval: false,
          },
        })),
      },
      learning,
      executor,
      store,
      hashValue: () => "hash",
      now: () => NOW,
    });

    expect(result.decision.decision).toBe("defer");
    expect(result.decision.metadata).toMatchObject({
      phase: "memory",
      memoryVersion: "v0.12",
    });
    expect(store.saveDecision).toHaveBeenCalledTimes(1);
    expect(planner.plan).not.toHaveBeenCalled();
    expect(executor.execute).not.toHaveBeenCalled();
    expect(learning.observe).toHaveBeenCalledTimes(1);
  });
});
