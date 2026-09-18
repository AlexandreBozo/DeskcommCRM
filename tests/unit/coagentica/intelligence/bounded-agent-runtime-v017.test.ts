import { describe, expect, it, vi } from "vitest";
import { createAgentExecutionBudget } from "@/coagentica/intelligence/contracts/agent-runtime";
import { createBoundedAgentRuntime, AgentRuntimeBudgetError } from "@/coagentica/intelligence/adapters/bounded-agent-runtime";

function invocation(planId: string, stepIndex: number, stepCount: number) {
  return {
    request: {} as any,
    context: null,
    invocation: {
      invocationId: `${planId}-${stepIndex}`,
      capability: "system.runtime.info",
      input: {},
      status: "pending" as const,
      startedAt: "2026-09-18T12:00:00.000Z",
      metadata: {
        planId,
        stepId: `${planId}-step-${stepIndex + 1}`,
        planningStrategy: "goal-aware-multi-step",
        planStepIndex: stepIndex,
        planStepCount: stepCount,
      },
      actorContext: {} as any,
    },
  };
}

describe("bounded agent runtime v0.17", () => {
  it("expõe status multi-step quando budget permite múltiplos passos", () => {
    const runtime = createBoundedAgentRuntime(
      { execute: vi.fn(async ({ invocation }) => ({ ...invocation, status: "completed" as const })) },
      createAgentExecutionBudget({ maxPlanSteps: 3, maxCapabilityInvocations: 3 })
    );
    expect(runtime.status()).toMatchObject({ version: "v0.17", mode: "bounded-multi-step" });
  });

  it("impõe budget por plano", async () => {
    const executor = { execute: vi.fn(async ({ invocation }) => ({ ...invocation, status: "completed" as const })) };
    const runtime = createBoundedAgentRuntime(
      executor,
      createAgentExecutionBudget({ maxPlanSteps: 3, maxCapabilityInvocations: 2 })
    );

    await runtime.execute(invocation("plan-1", 0, 3) as any);
    await runtime.execute(invocation("plan-1", 1, 3) as any);
    await expect(runtime.execute(invocation("plan-1", 2, 3) as any)).rejects.toBeInstanceOf(AgentRuntimeBudgetError);
    expect(executor.execute).toHaveBeenCalledTimes(2);
  });

  it("rejeita plano maior que maxPlanSteps", async () => {
    const runtime = createBoundedAgentRuntime(
      { execute: vi.fn(async ({ invocation }) => ({ ...invocation, status: "completed" as const })) },
      createAgentExecutionBudget({ maxPlanSteps: 2, maxCapabilityInvocations: 2 })
    );
    await expect(runtime.execute(invocation("plan-big", 0, 3) as any)).rejects.toThrow("maxPlanSteps");
  });
});
