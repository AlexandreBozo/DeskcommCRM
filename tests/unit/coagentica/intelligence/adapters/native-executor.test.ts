import { describe, expect, it, vi } from "vitest";
import {
  createNativeExecutor,
  defineNativeCapability,
} from "@/coagentica/intelligence/adapters/native-executor";
import {
  createActorContext,
  createTenantContext,
} from "@/coagentica/foundation/contracts/tenancy";
import { createIntelligenceRequest } from "@/coagentica/intelligence/contracts";
import type { CapabilityExecuteInput } from "@/coagentica/intelligence/ports/capability-executor-port";

const NOW = "2026-09-14T00:00:00.000Z";

function inputFor(capability: string) {
  const tenant = createTenantContext({
    tenantId: "tenant-1",
    organizationId: "tenant-1",
    organizationName: "Tenant 1",
    role: "agent",
    visibilityMode: "own",
    locale: "pt-BR",
    timezone: "America/Sao_Paulo",
    isPlatformAdmin: false,
  });
  const actor = createActorContext({
    actorId: "actor-1",
    actorType: "human",
    tenantContext: tenant,
    correlationId: "corr-1",
  });
  return {
    request: createIntelligenceRequest({
      requestId: "req-1",
      tenantContext: tenant,
      actorContext: actor,
      capability,
      input: { message: "oi" },
    }),
    invocation: {
      invocationId: "req-1-invocation",
      capability,
      input: { message: "oi" },
      status: "pending" as const,
      startedAt: NOW,
      metadata: {},
      actorContext: actor,
    },
    context: null,
  };
}

describe("native-executor adapter", () => {
  it("compõe handlers explícitos em um CapabilityExecutorPort", async () => {
    const execute = vi.fn(async (input: CapabilityExecuteInput) => ({
      ...input.invocation,
      status: "completed" as const,
      completedAt: NOW,
      output: { answer: "ok" },
    }));
    const handler = defineNativeCapability(" lead.responder ", execute);
    const executor = createNativeExecutor([handler]);

    const result = await executor.execute(inputFor("lead.responder"));
    expect(handler.capability).toBe("lead.responder");
    expect(result.status).toBe("completed");
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("rejeita definição com nome vazio", () => {
    expect(() =>
      defineNativeCapability("   ", async (input) => input.invocation)
    ).toThrow("capability é obrigatória");
  });
});
