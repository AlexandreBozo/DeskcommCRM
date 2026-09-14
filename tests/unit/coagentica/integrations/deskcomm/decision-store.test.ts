import { describe, expect, it, vi } from "vitest";
import { createDeskcommDecisionStore } from "@/coagentica/modules/system/decision-store";
import type { DecisionRecord } from "@/coagentica/intelligence/contracts";

describe("deskcomm decision store", () => {
  it("persiste decisão no audit log com tenant e hashes", async () => {
    const insert = vi.fn(async () => ({ error: null }));
    const from = vi.fn(() => ({ insert }));
    const client = { from } as never;
    const store = createDeskcommDecisionStore(client);
    const record: DecisionRecord = {
      decisionId: "dec-1",
      tenantId: "tenant-1",
      actorId: "11111111-1111-4111-8111-111111111111",
      correlationId: "corr-1",
      capability: "system.runtime.info",
      decision: "allow",
      reason: "ok",
      inputHash: "h1",
      outputHash: "h2",
      timestamp: "2026-09-14T00:00:00.000Z",
      metadata: {},
    };
    await expect(store.saveDecision(record)).resolves.toBe(record);
    expect(from).toHaveBeenCalledWith("api_audit_log");
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      organization_id: "tenant-1",
      actor_user_id: record.actorId,
      resource_id: "dec-1",
      action: "coagentica.intelligence.decision",
      metadata: expect.objectContaining({ input_hash: "h1", output_hash: "h2" }),
    }));
  });

  it("propaga falha do audit log", async () => {
    const client = {
      from: () => ({ insert: async () => ({ error: { message: "db down" } }) }),
    } as never;
    await expect(createDeskcommDecisionStore(client).saveDecision({
      decisionId: "dec-1", tenantId: "tenant-1", actorId: "u", correlationId: "c",
      capability: "x", decision: "deny", reason: "no", inputHash: "h",
      timestamp: "2026-09-14T00:00:00.000Z", metadata: {},
    })).rejects.toThrow("decision store falhou");
  });
});
