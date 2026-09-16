import { describe, expect, it, vi } from "vitest";
import { createDeskcommLearningObserver } from "@/coagentica/modules/system/learning-observer";

describe("deskcomm learning observer", () => {
  it("persiste observação sanitizada no audit log", async () => {
    const insert = vi.fn(async () => ({ error: null }));
    const from = vi.fn(() => ({ insert }));
    const observer = createDeskcommLearningObserver({ from } as never);
    await observer.observe({
      observationId: "req-1-learning", requestId: "req-1", tenantId: "tenant-1",
      actorId: "11111111-1111-4111-8111-111111111111", correlationId: "corr-1",
      capability: "system.runtime.info", decision: "allow", outcome: "completed",
      inputHash: "h1", outputHash: "h2", planId: "p-1", stepId: "s-1", planningStrategy: "direct",
      observedAt: "2026-09-16T20:00:00.000Z", metadata: { version: "v0.11", mode: "observational" },
    });
    expect(from).toHaveBeenCalledWith("api_audit_log");
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      action: "coagentica.intelligence.learning", organization_id: "tenant-1",
      resource_id: null, metadata: expect.objectContaining({ input_hash: "h1", output_hash: "h2", planning_strategy: "direct" })
    }));
  });

  it("ipropaga falha do adapter", async () => {
    const observer = createDeskcommLearningObserver({ from: () => ({ insert: async () => ({ error: { message: "db down" } }) }) } as never);
    await expect(observer.observe({
      observationId: "o", requestId: "r", tenantId: "t", actorId: "u", correlationId: "c", capability: "x",
      decision: "deny", outcome: "blocked", inputHash: "h", observedAt: "2026-09-16T20:00:00.000Z", metadata: {}
    })).rejects.toThrow("learning observer falhou");
  });
});
