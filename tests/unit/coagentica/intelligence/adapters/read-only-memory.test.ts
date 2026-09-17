import { describe, expect, it } from "vitest";
import { createMemoryBudget } from "@/coagentica/intelligence/contracts/memory";
import { createReadOnlyMemory } from "@/coagentica/intelligence/adapters/read-only-memory";
import type { TenantOperationalContextView } from "@/coagentica/intelligence/ports/tenant-operational-context-port";

function context(tenantId = "tenant-1"): TenantOperationalContextView {
  return {
    tenantId,
    organizationId: tenantId,
    sourceVersion: 1,
    snapshotAt: "2026-09-16T00:00:00.000Z",
    entities: [],
    relationships: [],
    knowledgeSources: [],
    memoryEntries: [
      { entryId: "m1", type: "fact", content: "ativo-1", status: "active", metadata: {} },
      { entryId: "m2", type: "fact", content: "arquivado", status: "archived", metadata: {} },
      { entryId: "m3", type: "insight", content: "ativo-2", status: "active", metadata: {} },
      { entryId: "m4", type: "note", content: "pendente", status: "pending", metadata: {} },
    ],
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
}

describe("read-only memory v0.12", () => {
  it("seleciona somente memória ativa e respeita budget", async () => {
    const memory = createReadOnlyMemory(createMemoryBudget(1));
    const result = await memory.prepare({ tenantId: "tenant-1", context: context() });

    expect(result.selectedCount).toBe(1);
    expect(result.truncated).toBe(true);
    expect(result.context.memoryEntries.map((entry) => entry.entryId)).toEqual(["m1"]);
    expect(result.status).toMatchObject({
      version: "v0.12",
      mode: "read-only",
      writesEnabled: false,
    });
  });

  it("preserva truncamento vindo da fonte", async () => {
    const base = context();
    const memory = createReadOnlyMemory(createMemoryBudget(20));
    const result = await memory.prepare({
      tenantId: "tenant-1",
      context: {
        ...base,
        truncated: { ...base.truncated, memoryEntries: true },
      },
    });

    expect(result.selectedCount).toBe(2);
    expect(result.truncated).toBe(true);
  });

  it("bloqueia contexto de outro tenant", async () => {
    const memory = createReadOnlyMemory(createMemoryBudget());
    await expect(
      memory.prepare({ tenantId: "tenant-1", context: context("tenant-2") })
    ).rejects.toThrow("outro tenant");
  });
});
