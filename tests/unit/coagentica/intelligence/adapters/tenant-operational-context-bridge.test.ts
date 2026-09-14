import { describe, expect, it } from "vitest";
import { createTenantContext } from "@/coagentica/foundation/contracts/tenancy";
import {
  assertOperationalSnapshotTenantBoundary,
  createTenantOperationalContextBridge,
} from "@/coagentica/intelligence/adapters/tenant-operational-context-bridge";
import type { TenantStateSourcePort } from "@/coagentica/tenant-runtime/ports/state-source";

const iso = "2026-09-14T09:00:00.000Z";

function sourceFor(tenantId = "tenant-1"): TenantStateSourcePort {
  return {
    async loadTenantState() {
      return {
        tenantId,
        entities: [
          {
            ref: { entityId: "contact-1", tenantId, entityKind: "contact" },
            version: 1,
            data: { name: "Maria", nested: { score: 10 } },
            createdAt: iso,
            updatedAt: iso,
            source: "deskcomm.contacts",
          },
          {
            ref: { entityId: "contact-2", tenantId, entityKind: "contact" },
            version: 1,
            data: { name: "João" },
            createdAt: iso,
            updatedAt: iso,
            source: "deskcomm.contacts",
          },
        ],
        relationships: [
          {
            sourceEntityId: "contact-1",
            targetEntityId: tenantId,
            tenantId,
            relationshipType: "contact_belongs_to_organization",
          },
        ],
        knowledgeSources: [
          {
            sourceId: "kb-1",
            tenantId,
            name: "Catálogo",
            type: "catalog",
            status: "active",
            metadata: { chunks: 5 },
            createdAt: iso,
            updatedAt: iso,
          },
        ],
        memoryEntries: [
          {
            entryId: "mem-1",
            tenantId,
            type: "note",
            content: "Atendimento consultivo",
            metadata: { source: "manual" },
            status: "active",
            createdAt: iso,
            updatedAt: iso,
          },
        ],
        goals: [
          {
            goalId: "goal-1",
            tenantId,
            name: "Crescer conversão",
            description: "Elevar conversão comercial",
            status: "active",
            metadata: { priority: "high" },
            createdAt: iso,
            updatedAt: iso,
          },
        ],
        capabilities: [
          {
            capabilityId: "skill:sales",
            tenantId,
            name: "sales",
            type: "tool",
            status: "available",
            config: { versionId: "v1" },
            metadata: { platformScoped: false },
            createdAt: iso,
            updatedAt: iso,
          },
        ],
        sourceVersion: 7,
      };
    },
  };
}

describe("tenant-operational-context-bridge", () => {
  it("projeta snapshot operacional para view da Intelligence", async () => {
    const port = createTenantOperationalContextBridge(sourceFor());
    const view = await port.loadOperationalContext({
      tenantContext: createTenantContext("tenant-1"),
      selection: {
        includeEntities: true,
        includeRelationships: true,
        includeKnowledgeSources: true,
        includeMemoryEntries: true,
        includeGoals: true,
        includeCapabilities: true,
      },
    });

    expect(view.tenantId).toBe("tenant-1");
    expect(view.organizationId).toBe("tenant-1");
    expect(view.sourceVersion).toBe(7);
    expect(view.entities).toHaveLength(2);
    expect(view.memoryEntries[0]?.content).toBe("Atendimento consultivo");
    expect(view.capabilities[0]?.capabilityId).toBe("skill:sales");
    expect(view.truncated.entities).toBe(false);
  });

  it("não expõe fatias operacionais sem seleção explícita", async () => {
    const port = createTenantOperationalContextBridge(sourceFor());
    const view = await port.loadOperationalContext({
      tenantContext: createTenantContext("tenant-1"),
    });

    expect(view.entities).toEqual([]);
    expect(view.relationships).toEqual([]);
    expect(view.knowledgeSources).toEqual([]);
    expect(view.memoryEntries).toEqual([]);
    expect(view.goals).toEqual([]);
    expect(view.capabilities).toEqual([]);
    expect(view.truncated.entities).toBe(false);
  });

  it("aplica limites e informa truncamento apenas sobre fatias selecionadas", async () => {
    const port = createTenantOperationalContextBridge(sourceFor());
    const view = await port.loadOperationalContext({
      tenantContext: createTenantContext("tenant-1"),
      selection: {
        includeEntities: true,
        includeMemoryEntries: true,
      },
      limits: { maxEntities: 1, maxMemoryEntries: 0 },
    });

    expect(view.entities).toHaveLength(1);
    expect(view.memoryEntries).toHaveLength(0);
    expect(view.truncated.entities).toBe(true);
    expect(view.truncated.memoryEntries).toBe(true);
  });

  it("seleciona fatias específicas por ID sem ampliar o restante do contexto", async () => {
    const port = createTenantOperationalContextBridge(sourceFor());
    const view = await port.loadOperationalContext({
      tenantContext: createTenantContext("tenant-1"),
      selection: {
        entityIds: ["contact-2"],
        relationshipEntityIds: ["contact-1"],
        knowledgeSourceIds: ["kb-1"],
        memoryEntryIds: ["mem-1"],
        goalIds: ["goal-1"],
        capabilityIds: ["skill:sales"],
      },
    });

    expect(view.entities.map((entity) => entity.entityId)).toEqual(["contact-2"]);
    expect(view.relationships).toHaveLength(1);
    expect(view.relationships[0]?.sourceEntityId).toBe("contact-1");
    expect(view.knowledgeSources.map((source) => source.sourceId)).toEqual(["kb-1"]);
    expect(view.memoryEntries.map((entry) => entry.entryId)).toEqual(["mem-1"]);
    expect(view.goals.map((goal) => goal.goalId)).toEqual(["goal-1"]);
    expect(view.capabilities.map((capability) => capability.capabilityId)).toEqual([
      "skill:sales",
    ]);
  });

  it("revalida todas as fatias contra o tenant antes de projetar contexto", async () => {
    const base = await sourceFor().loadTenantState("tenant-1");
    const snapshot = {
      ...base,
      version: 1,
      snapshotAt: iso,
    };

    const cases = [
      {
        label: "entity",
        snapshot: {
          ...snapshot,
          entities: [
            {
              ...snapshot.entities[0]!,
              ref: { ...snapshot.entities[0]!.ref, tenantId: "tenant-2" },
            },
          ],
        },
      },
      {
        label: "relationship",
        snapshot: {
          ...snapshot,
          relationships: [
            { ...snapshot.relationships[0]!, tenantId: "tenant-2" },
          ],
        },
      },
      {
        label: "knowledge",
        snapshot: {
          ...snapshot,
          knowledgeSources: [
            { ...snapshot.knowledgeSources[0]!, tenantId: "tenant-2" },
          ],
        },
      },
      {
        label: "memory",
        snapshot: {
          ...snapshot,
          memoryEntries: [
            { ...snapshot.memoryEntries[0]!, tenantId: "tenant-2" },
          ],
        },
      },
      {
        label: "goal",
        snapshot: {
          ...snapshot,
          goals: [{ ...snapshot.goals[0]!, tenantId: "tenant-2" }],
        },
      },
      {
        label: "capability",
        snapshot: {
          ...snapshot,
          capabilities: [
            { ...snapshot.capabilities[0]!, tenantId: "tenant-2" },
          ],
        },
      },
    ];

    for (const item of cases) {
      expect(
        () => assertOperationalSnapshotTenantBoundary(item.snapshot, "tenant-1"),
        item.label
      ).toThrow("outro tenant");
    }
  });

  it("rejeita TenantContext com organizationId divergente", async () => {
    const port = createTenantOperationalContextBridge(sourceFor());

    await expect(
      port.loadOperationalContext({
        tenantContext: createTenantContext({
          tenantId: "tenant-1",
          organizationId: "tenant-2",
        }),
      })
    ).rejects.toThrow("organizationId difere de tenantId");
  });

  it("rejeita snapshot contendo item de outro tenant", async () => {
    const foreignSource: TenantStateSourcePort = {
      async loadTenantState(tenantId) {
        const data = await sourceFor(tenantId).loadTenantState(tenantId);
        return {
          ...data,
          entities: [
            {
              ...data.entities[0]!,
              ref: {
                ...data.entities[0]!.ref,
                tenantId: "tenant-2",
              },
            },
          ],
        };
      },
    };
    const port = createTenantOperationalContextBridge(foreignSource);

    await expect(
      port.loadOperationalContext({
        tenantContext: createTenantContext("tenant-1"),
      })
    ).rejects.toThrow("pertence a outro tenant");
  });

  it("propaga falha da fonte em vez de devolver contexto vazio", async () => {
    const failing: TenantStateSourcePort = {
      async loadTenantState() {
        throw new Error("fonte indisponível");
      },
    };
    const port = createTenantOperationalContextBridge(failing);

    await expect(
      port.loadOperationalContext({
        tenantContext: createTenantContext("tenant-1"),
      })
    ).rejects.toThrow("fonte indisponível");
  });

  it("clona data/config/metadata antes de expor à Intelligence", async () => {
    const source = sourceFor();
    const raw = await source.loadTenantState("tenant-1");
    const port = createTenantOperationalContextBridge({
      async loadTenantState() {
        return raw;
      },
    });

    const view = await port.loadOperationalContext({
      tenantContext: createTenantContext("tenant-1"),
      selection: {
        includeEntities: true,
        includeCapabilities: true,
      },
    });

    (raw.entities[0]!.data as { nested: { score: number } }).nested.score = 99;
    (raw.capabilities[0]!.config as { versionId: string }).versionId = "mutated";

    expect(
      (view.entities[0]!.data.nested as { score: number }).score
    ).toBe(10);
    expect(view.capabilities[0]!.config.versionId).toBe("v1");
  });

  it("clampa limites acima do hard cap", async () => {
    const source: TenantStateSourcePort = {
      async loadTenantState(tenantId) {
        const base = await sourceFor(tenantId).loadTenantState(tenantId);
        return {
          ...base,
          entities: Array.from({ length: 501 }, (_, index) => ({
            ...base.entities[0]!,
            ref: {
              ...base.entities[0]!.ref,
              entityId: `contact-${index + 1}`,
            },
          })),
        };
      },
    };
    const port = createTenantOperationalContextBridge(source);

    const view = await port.loadOperationalContext({
      tenantContext: createTenantContext("tenant-1"),
      selection: { includeEntities: true },
      limits: { maxEntities: 9999 },
    });

    expect(view.entities).toHaveLength(500);
    expect(view.truncated.entities).toBe(true);
  });

  it("rejeita limite negativo", async () => {
    const port = createTenantOperationalContextBridge(sourceFor());

    await expect(
      port.loadOperationalContext({
        tenantContext: createTenantContext("tenant-1"),
        limits: { maxEntities: -1 },
      })
    ).rejects.toThrow("limite de contexto operacional inválido");
  });
});
