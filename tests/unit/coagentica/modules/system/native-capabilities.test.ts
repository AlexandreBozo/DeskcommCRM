import { describe, expect, it } from "vitest";
import { createActorContext, createTenantContext } from "@/coagentica/foundation/contracts/tenancy";
import { createIntelligenceRequest, type CapabilityInvocation } from "@/coagentica/intelligence/contracts";
import { createSystemNativeCapabilities } from "@/coagentica/modules/system/native-capabilities";
import type { CapabilityExecuteInput } from "@/coagentica/intelligence/ports/capability-executor-port";

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
  actorId: "11111111-1111-4111-8111-111111111111",
  actorType: "human",
  tenantContext,
  correlationId: "corr-1",
});

function input(capability: string, context: CapabilityExecuteInput["context"]): CapabilityExecuteInput {
  const request = createIntelligenceRequest({
    requestId: "req-1",
    tenantContext,
    actorContext,
    capability,
    input: {},
  });
  const invocation: CapabilityInvocation = {
    invocationId: "inv-1",
    capability,
    input: {},
    status: "pending",
    startedAt: request.timestamp,
    metadata: {},
    actorContext,
  };
  return { request, invocation, context };
}

const view = {
  tenantId: "tenant-1",
  organizationId: "tenant-1",
  sourceVersion: 1,
  snapshotAt: "2026-09-14T00:00:00.000Z",
  entities: [{
    entityId: "c-1",
    entityKind: "contact",
    version: 1,
    data: { email: "secret@example.com" },
    updatedAt: "2026-09-14T00:00:00.000Z",
    source: "test",
  }],
  relationships: [],
  knowledgeSources: [{ sourceId: "k-1", name: "Privado", type: "document", status: "active", metadata: { secret: true } }],
  memoryEntries: [{ entryId: "m-1", type: "fact", content: "PII", status: "active", metadata: {} }],
  goals: [],
  capabilities: [{ capabilityId: "cap-1", name: "cap-1", type: "tool", status: "available", config: { token: "x" }, metadata: {} }],
  truncated: { entities: false, relationships: false, knowledgeSources: false, memoryEntries: false, goals: false, capabilities: false },
} as CapabilityExecuteInput["context"];

describe("system native capabilities", () => {
  it("context summary retorna contagens sem dados brutos", async () => {
    const handler = createSystemNativeCapabilities().find((x) => x.capability === "tenant.context.summary")!;
    const result = await handler.execute(input(handler.capability, view));
    const output = result.output as Record<string, unknown>;
    expect(output.counts).toMatchObject({ entities: 1, memoryEntries: 1, knowledgeSources: 1 });
    expect(JSON.stringify(output)).not.toContain("secret@example.com");
    expect(JSON.stringify(output)).not.toContain("PII");
  });

  it("goals list expõe somente a visão read-only autorizada", async () => {
    const withGoal = {
      ...view!,
      goals: [
        { goalId: "g-1", name: "Crescer", description: "Aumentar receita", status: "active", metadata: {} },
      ],
    } as CapabilityExecuteInput["context"];
    const handler = createSystemNativeCapabilities().find((x) => x.capability === "tenant.goals.list")!;
    const result = await handler.execute(input(handler.capability, withGoal));
    expect(result.output).toMatchObject({
      tenantId: "tenant-1",
      goals: [{ goalId: "g-1", name: "Crescer", description: "Aumentar receita", status: "active" }],
    });
    expect(JSON.stringify(result.output)).not.toContain("metadata");
  });

  it("capability list não expõe config ou metadata", async () => {
    const handler = createSystemNativeCapabilities().find((x) => x.capability === "tenant.capabilities.list")!;
    const result = await handler.execute(input(handler.capability, view));
    expect(JSON.stringify(result.output)).not.toContain("token");
    expect(JSON.stringify(result.output)).not.toContain("metadata");
  });

  it("runtime info funciona sem contexto", async () => {
    const handler = createSystemNativeCapabilities().find((x) => x.capability === "system.runtime.info")!;
    const result = await handler.execute(input(handler.capability, null));
    expect(result.status).toBe("completed");
    expect(result.output).toMatchObject({
      architecture: "coagentica",
      runtimeRelease: "v1.0",
      foundation: "v1.0",
      intelligenceRuntime: "v0.5",
      planning: {
        goalAware: "v0.14",
        multiStep: "v0.16",
        maxSteps: 1,
      },
      goals: { version: "v0.13", mode: "read-only" },
      contextEngine: { version: "v0.15", mode: "bounded-relevance" },
      nativeActions: { version: "v0.18", mutationsEnabled: false },
      governance: { version: "v0.19", mode: "human-in-the-loop" },
      channels: { version: "v0.20", normalizedInput: true },
      learning: "v0.11",
      agentRuntime: {
        version: "v0.10",
        mode: "bounded",
        budget: {
          maxPlanSteps: 1,
          maxCapabilityInvocations: 1,
          maxModelCalls: 0,
          autonomous: false,
        },
      },
      modelGateway: { version: "v0.8", available: false, profiles: [] },
    });
  });

  it("runtime info expõe apenas status canônico do Model Gateway", async () => {
    const modelGateway = {
      async status() {
        return { available: true, profiles: ["fast", "balanced", "reasoning"] as const };
      },
      async generate() {
        throw new Error("não deve ser chamado por runtime info");
      },
    };
    const handler = createSystemNativeCapabilities({ modelGateway }).find(
      (x) => x.capability === "system.runtime.info",
    )!;
    const result = await handler.execute(input(handler.capability, null));
    const serialized = JSON.stringify(result.output);

    expect(result.output).toMatchObject({
      modelGateway: {
        version: "v0.8",
        available: true,
        profiles: ["fast", "balanced", "reasoning"],
      },
    });
    expect(serialized).not.toMatch(/anthropic|openai|google|provider|modelId/);
  });
});
