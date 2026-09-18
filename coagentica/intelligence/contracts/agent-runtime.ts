export interface AgentExecutionBudget {
  readonly maxPlanSteps: number;
  readonly maxCapabilityInvocations: number;
  readonly maxModelCalls: number;
  readonly autonomous: false;
}

export interface AgentRuntimeStatus {
  readonly version: "v0.10" | "v0.17";
  readonly mode: "bounded" | "bounded-multi-step";
  readonly budget: AgentExecutionBudget;
}

export function createAgentExecutionBudget(
  params: Partial<Omit<AgentExecutionBudget, "autonomous">> = {}
): AgentExecutionBudget {
  const budget: AgentExecutionBudget = {
    maxPlanSteps: params.maxPlanSteps ?? 1,
    maxCapabilityInvocations: params.maxCapabilityInvocations ?? 1,
    maxModelCalls: params.maxModelCalls ?? 0,
    autonomous: false,
  };

  for (const [name, value] of Object.entries({
    maxPlanSteps: budget.maxPlanSteps,
    maxCapabilityInvocations: budget.maxCapabilityInvocations,
    maxModelCalls: budget.maxModelCalls,
  })) {
    if (!Number.isInteger(value) || value < 0) {
      throw new Error(`${name} deve ser inteiro não-negativo`);
    }
  }

  return budget;
}

export function createAgentRuntimeStatus(
  budget: AgentExecutionBudget
): AgentRuntimeStatus {
  const multiStep = budget.maxPlanSteps > 1 || budget.maxCapabilityInvocations > 1;
  return {
    version: multiStep ? "v0.17" : "v0.10",
    mode: multiStep ? "bounded-multi-step" : "bounded",
    budget,
  };
}
