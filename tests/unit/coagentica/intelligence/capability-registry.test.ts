import { describe, expect, it, vi } from "vitest";
import {
  CapabilityContractError,
  CapabilityUnavailableError,
  DuplicateCapabilityError,
  InvalidCapabilityRegistrationError,
  UnknownCapabilityError,
  createCapabilityRegistry,
} from "@/coagentica/intelligence/capability-registry";
import type { NativeCapabilityHandler } from "@/coagentica/intelligence/ports/capability-handler-port";
import type { CapabilityExecuteInput } from "@/coagentica/intelligence/ports/capability-executor-port";
import { createActorContext, createTenantContext } from "@/coagentica/foundation/contracts/tenancy";
import { createIntelligenceRequest } from "@/coagentica/intelligence/contracts";

const NOW = "2026-09-14T00:00:00.000Z";
function input(capability = "lead.responder", context: CapabilityExecuteInput["context"] = null): CapabilityExecuteInput {
  const tenantContext = createTenantContext({
    tenantId: "tenant-1", organizationId: "tenant-1", organizationName: "T1",
    role: "agent", visibilityMode: "own", locale: "pt-BR",
    timezone: "America/Sao_Paulo", isPlatformAdmin: false,
  });
  const actorContext = createActorContext({
    actorId: "actor-1", actorType: "human", tenantContext, correlationId: "corr-1",
  });
  return {
    request: createIntelligenceRequest({
      requestId: "req-1", tenantContext, actorContext, capability, input: { message: "oi" },
    }),
    invocation: {
      invocationId: "req-1-invocation", capability, input: { message: "oi" },
      status: "pending", startedAt: NOW, metadata: {}, actorContext,
    },
    context,
  };
}
function handler(capability = "lead.responder"): NativeCapabilityHandler & { execute: ReturnType<typeof vi.fn> } {
  return {
    capability,
    execute: vi.fn(async (value: CapabilityExecuteInput) => ({
      ...value.invocation, status: "completed" as const, completedAt: NOW, output: { ok: true },
    })),
  };
}
function inventory(status: string): NonNullable<CapabilityExecuteInput["context"]> {
  return {
    tenantId: "tenant-1", organizationId: "tenant-1", sourceVersion: 1, snapshotAt: NOW,
    entities: [], relationships: [], knowledgeSources: [], memoryEntries: [], goals: [],
    capabilities: [{
      capabilityId: "lead.responder", name: "lead.responder", type: "tool", status,
      config: {}, metadata: {},
    }],
    truncated: { entities: false, relationships: false, knowledgeSources: false, memoryEntries: false, goals: false, capabilities: false },
  };
}

describe("capability-registry", () => {
  it("despacha exact-match", async () => {
    const h = handler();
    const registry = createCapabilityRegistry([h]);
    await expect(registry.execute(input())).resolves.toMatchObject({
      invocationId: "req-1-invocation", capability: "lead.responder", status: "completed",
    });
    expect(h.execute).toHaveBeenCalledTimes(1);
  });

  it("falha fechada para desconhecida, duplicada, vazia e case diferente", async () => {
    const registry = createCapabilityRegistry([handler()]);
    await expect(registry.execute(input("lead.unknown"))).rejects.toBeInstanceOf(UnknownCapabilityError);
    await expect(registry.execute(input("Lead.Responder"))).rejects.toBeInstanceOf(UnknownCapabilityError);
    expect(() => createCapabilityRegistry([handler(), handler()])).toThrow(DuplicateCapabilityError);
    expect(() => createCapabilityRegistry([handler("   ")])).toThrow(InvalidCapabilityRegistrationError);
  });

  it.each(["unavailable", "degraded"])("bloqueia inventory %s", async (status) => {
    const h = handler();
    const registry = createCapabilityRegistry([h]);
    await expect(registry.execute(input("lead.responder", inventory(status)))).rejects.toBeInstanceOf(CapabilityUnavailableError);
    expect(h.execute).not.toHaveBeenCalled();
  });

  it("permite inventory available e não inventa inventory quando contexto é nulo", async () => {
    const h = handler();
    const registry = createCapabilityRegistry([h]);
    await registry.execute(input("lead.responder", inventory("available")));
    await registry.execute(input());
    expect(h.execute).toHaveBeenCalledTimes(2);
  });

  it("rejeita contexto cross-tenant e divergence request/invocation", async () => {
    const h = handler();
    const registry = createCapabilityRegistry([h]);
    const foreign = { ...inventory("available"), tenantId: "tenant-2", organizationId: "tenant-2" };
    await expect(registry.execute(input("lead.responder", foreign))).rejects.toBeInstanceOf(CapabilityContractError);
    const value = input();
    await expect(registry.execute({ ...value, invocation: { ...value.invocation, capability: "lead.outra" } })).rejects.toBeInstanceOf(CapabilityContractError);
    expect(h.execute).not.toHaveBeenCalled();
  });

  it("rejeita handler que altera capability ou invocationId", async () => {
    const badCapability: NativeCapabilityHandler = {
      capability: "lead.responder",
      async execute(value) { return { ...value.invocation, capability: "lead.outra", status: "completed", completedAt: NOW }; },
    };
    await expect(createCapabilityRegistry([badCapability]).execute(input())).rejects.toBeInstanceOf(CapabilityContractError);

    const badInvocation: NativeCapabilityHandler = {
      capability: "lead.responder",
      async execute(value) { return { ...value.invocation, invocationId: "inv-outro", status: "completed", completedAt: NOW }; },
    };
    await expect(createCapabilityRegistry([badInvocation]).execute(input())).rejects.toBeInstanceOf(CapabilityContractError);
  });
});
