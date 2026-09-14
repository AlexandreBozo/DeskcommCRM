import { describe, expect, it } from "vitest";
import { assembleTenantState } from "@/coagentica/tenant-runtime/assembler/tenant-state-assembler";
import type {
  TenantStateSourceData,
  TenantStateSourcePort,
} from "@/coagentica/tenant-runtime/ports/state-source";

function sourceWith(
  data: TenantStateSourceData
): TenantStateSourcePort {
  return {
    async loadTenantState() {
      return data;
    },
  };
}

function emptyState(tenantId = "tenant-1"): TenantStateSourceData {
  return {
    tenantId,
    entities: [],
    relationships: [],
    knowledgeSources: [],
    memoryEntries: [],
    goals: [],
    capabilities: [],
    sourceVersion: 1,
  };
}

describe("coagentica/tenant-runtime/assembler/tenant-state-assembler", () => {
  it("monta snapshot válido a partir da source", async () => {
    const snapshot = await assembleTenantState(
      sourceWith({ ...emptyState(), sourceVersion: 7 }),
      "tenant-1"
    );

    expect(snapshot.tenantId).toBe("tenant-1");
    expect(snapshot.version).toBe(7);
    expect(snapshot.entities).toEqual([]);
  });

  it("normaliza tenantId antes de consultar a source", async () => {
    let received = "";
    const source: TenantStateSourcePort = {
      async loadTenantState(tenantId) {
        received = tenantId;
        return emptyState(tenantId);
      },
    };

    await assembleTenantState(source, "  tenant-1  ");
    expect(received).toBe("tenant-1");
  });

  it("rejeita source que retorna outro tenant", async () => {
    await expect(
      assembleTenantState(sourceWith(emptyState("tenant-2")), "tenant-1")
    ).rejects.toThrow("tenant state source retornou outro tenant");
  });

  it("rejeita item cross-tenant mesmo quando source declara tenant correto", async () => {
    const data: TenantStateSourceData = {
      ...emptyState(),
      entities: [
        {
          ref: {
            entityId: "contact-1",
            tenantId: "tenant-2",
            entityKind: "contact",
          },
          version: 1,
          data: {},
          createdAt: "2026-09-01T10:00:00.000Z",
          updatedAt: "2026-09-01T10:00:00.000Z",
          source: "test",
        },
      ],
    };

    await expect(
      assembleTenantState(sourceWith(data), "tenant-1")
    ).rejects.toThrow("entity contact-1 pertence a outro tenant");
  });

  it("rejeita tenantId vazio", async () => {
    await expect(
      assembleTenantState(sourceWith(emptyState()), "   ")
    ).rejects.toThrow("tenantId é obrigatório");
  });
});
