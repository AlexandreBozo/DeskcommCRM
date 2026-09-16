import type { AgentExecutionBudget } from "../contracts/agent-runtime";
import {
  createAgentExecutionBudget,
  createAgentRuntimeStatus,
} from "../contracts/agent-runtime";
import type {
  CapabilityExecuteInput,
  CapabilityExecutorPort,
} from "../ports/capability-executor-port";
import type { AgentRuntimePort } from "../ports/agent-runtime-port";

export class AgentRuntimeContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AgentRuntimeContractError";
  }
}

export class AgentRuntimeBudgetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AgentRuntimeBudgetError";
  }
}

function requirePlanningIdentity(input: CapabilityExecuteInput): void {
  const metadata = input.invocation.metadata;
  const planId = metadata.planId;
  const stepId = metadata.stepId;
  const strategy = metadata.planningStrategy;

  if (
    typeof planId !== "string" ||
    planId.trim() === "" ||
    typeof stepId !== "string" ||
    stepId.trim() === "" ||
    strategy !== "direct"
  ) {
    throw new AgentRuntimeContractError(
      "invocação sem identidade canônica de planejamento"
    );
  }
}

function assertBudget(budget: AgentExecutionBudget): void {
  if (budget.maxPlanSteps < 1) {
    throw new AgentRuntimeBudgetError("orçamento não autoriza passos de plano");
  }
  if (budget.maxCapabilityInvocations < 1) {
    throw new AgentRuntimeBudgetError(
      "orçamento não autoriza invocações de capability"
    );
  }
  if (budget.autonomous !== false) {
    throw new AgentRuntimeBudgetError(
      "modo autônomo não é permitido nesta versão"
    );
  }
}

/**
 * Envelope nativo de execução limitada.
 *
 * v0.10 executa no máximo a única invocação já autorizada e planejada pelo
 * runtime. Não cria novos passos, não chama modelo e não faz retry implícito.
 */
export function createBoundedAgentRuntime(
  executor: CapabilityExecutorPort,
  budget: AgentExecutionBudget = createAgentExecutionBudget()
): AgentRuntimePort {
  const status = createAgentRuntimeStatus(budget);

  return {
    status() {
      return status;
    },

    async execute(input) {
      assertBudget(budget);
      requirePlanningIdentity(input);

      const result = await executor.execute(input);

      if (result.invocationId !== input.invocation.invocationId) {
        throw new AgentRuntimeContractError(
          "executor alterou invocationId canônico"
        );
      }
      if (result.capability !== input.invocation.capability) {
        throw new AgentRuntimeContractError(
          "executor alterou capability planejada"
        );
      }

      return result;
    },
  };
}
