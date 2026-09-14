import { describe, expect, it, vi } from "vitest";
import type { DecisionRecord } from "@/coagentica/intelligence/contracts";
import type { DecisionStorePort } from "@/coagentica/intelligence/ports/decision-store-port";

const record: DecisionRecord = {
  decisionId: "dec-1",
  tenantId: "tenant-1",
  actorId: "actor-1",
  correlationId: "corr-1",
  capability: "responder_lead",
  decision: "allow",
  reason: "autorizado",
  inputHash: "hash-in",
  timestamp: "2026-09-14T00:00:00.000Z",
  metadata: {},
};

describe("decision-store-port", () => {
  it("persiste e devolve o DecisionRecord canônico", async () => {
    const saveDecision = vi.fn(async (value: DecisionRecord) => value);
    const store: DecisionStorePort = { saveDecision };

    await expect(store.saveDecision(record)).resolves.toBe(record);
    expect(saveDecision).toHaveBeenCalledWith(record);
  });

  it("propaga falha da implementação concreta", async () => {
    const store: DecisionStorePort = {
      async saveDecision() {
        throw new Error("store indisponível");
      },
    };

    await expect(store.saveDecision(record)).rejects.toThrow("store indisponível");
  });
});
