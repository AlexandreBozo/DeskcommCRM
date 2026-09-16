import { describe, expect, it, vi } from "vitest";
import {
  createActorContext,
  createTenantContext,
} from "@/coagentica/foundation/contracts/tenancy";
import { createIntelligenceRequest } from "@/coagentica/intelligence/contracts";
import {
  AgentRuntimeBudgetError,
  AgentRuntimeContractError,
  createBoundedAgentRuntime,
} from "@/coagentica/intelligence/adapters/bounded-agent-runtime";
import { createAgentExecutionBudget } from "@/coagentica/intelligence/contracts/agent-runtime";
import type {
  CapabilityExecuteInput,
  CapabilityExecutorPort,
} from "@/coagentica/intelligence/ports/capability-executor-port";

const NOW = "2026-09-16T00:00:00.000Z";

function inputFor(metadata: Record<string, unknown> = {
  planId: "req-1-plan",
  stepId: "req-1-step-1",
  planningStrategy: "direct",
}): CapabilityExecuteInput {
  const tenantContext = createTenantContext({
    tenantId: "tenant-1",
    organizationId: "tenant-1",
    organizationName: "Tenant 1",
    role: "agent",
    visibilityMode: "own",
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
    requestId: "req-1",
    tenantContext,
    actorContext,
    capability: "system.runtime.info",
    input: {},
  });
  return {
    request,
    invocation: {
      invocationId: "req-1-invocation",
      capability: request.capability,
      input: {},
      status: "pending",
      startedAt: NOW,
      metadata,
      actorContext,
    },
    context: null,
  };
}

describe("bounded Agent Runtime adapter", () => {
  it("delega exatamente uma invocação planejada e preserva identidade", async () => {
    const execute = vi.fn(async (input: CapabilityExecuteInput) => ({
      ...input.invocation,
      status: "completed" as const,
      completedAt: NOW,
      output: { ok: true },
    }));
    const executor: CapabilityExecutorPort = { execute };
    const runtime = createBoundedAgentRuntime(executor);

    const result = await runtime.execute(inputFor());

    expect(execute).toHaveBeenCalledTimes(1);
    expect(result.invocationId).toBe("req-1-invocation");
    expect(result.capability).toBe("system.runtime.info");
    expect(runtime.status()).toEqual({
      version: "v0.10",
      mode: "bounded",
      budget: {
        maxPlanSteps: 1,
        maxCapabilityInvocations: 1,
        maxModelCalls: 0,
        autonomous: false,
      },
    });
  });

  it("rejeita invocação sem identidade canônica de planejamento", async () => {
    const executor: CapabilityExecutorPort = {
      execute: vi.fn(async (input) => input.invocation),
    };
    const runtime = createBoundedAgentRuntime(executor);

    await expect(runtime.execute(inputFor({}))).rejects.toBeInstanceOf(
      AgentRuntimeContractError,
    );
    expect(executor.execute).not.toHaveBeenCalled();
  });

  it("falha fechado quando o orçamento não autoriza capability", async () => {
    const executor: CapabilityExecutorPort = {
      execute: vi.fn(async (input) => input.invocation),
    };
    const runtime = createBoundedAgentRuntime(
      executor,
      createAgentExecutionBudget({ maxCapabilityInvocations: 0 }),
    );

    await expect(runtime.execute(inputFor())).rejects.toBeInstanceOf(
      AgentRuntimeBudgetError,
    );
    expect(executor.execute).not.toHaveBeenCalled();
  });

  it("rejeita executor que altera a identidade canônica", async () => {
    const executor: CapabilityExecutorPort = {
      execute: vi.fn(async (input) => ({
        ...input.invocation,
        invocationId: "outra-invocacao",
      })),
    };
    const runtime = createBoundedAgentRuntime(executor);

    await expect(runtime.execute(inputFor())).rejects.toBeInstanceOf(
      AgentRuntimeContractError,
    );
  });
});
