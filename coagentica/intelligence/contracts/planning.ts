import type { IntelligenceRequest } from "../contracts";

export type PlanningStrategy = "direct" | "goal-aware" | "goal-aware-multi-step";

export interface ExecutionPlanStep {
  readonly stepId: string;
  readonly capability: string;
  readonly input: Record<string, unknown>;
  readonly metadata: Record<string, unknown>;
}

export interface ExecutionPlan {
  readonly planId: string;
  readonly requestId: string;
  readonly tenantId: string;
  readonly actorId: string;
  readonly strategy: PlanningStrategy;
  readonly steps: readonly ExecutionPlanStep[];
  readonly metadata: Record<string, unknown>;
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

/**
 * Valida somente invariantes estruturais/canônicas do plano.
 *
 * A equivalência do input é validada pelo Intelligence Runtime usando o hash
 * canônico injetado, evitando que o contrato de planning conheça hashing.
 */
export function validateExecutionPlan(
  plan: ExecutionPlan,
  request: IntelligenceRequest,
): readonly string[] {
  const errors: string[] = [];

  if (!nonEmpty(plan?.planId)) errors.push("planId é obrigatório");
  if (plan?.requestId !== request.requestId) errors.push("requestId do plano diverge do request");
  if (plan?.tenantId !== request.tenantContext.tenantId) errors.push("tenantId do plano diverge do request");
  if (plan?.actorId !== request.actorContext.actorId) errors.push("actorId do plano diverge do request");
  if (!["direct", "goal-aware", "goal-aware-multi-step"].includes(plan?.strategy)) {
    errors.push("strategy de planejamento não suportada");
  }

  if (!Array.isArray(plan?.steps) || plan.steps.length < 1 || plan.steps.length > 3) {
    errors.push("planning exige entre um e três passos");
    return errors;
  }
  if (plan.strategy !== "goal-aware-multi-step" && plan.steps.length !== 1) {
    errors.push("planning single-step exige exatamente um passo");
  }

  const seen = new Set<string>();
  for (const [index, step] of plan.steps.entries()) {
    if (!nonEmpty(step?.stepId)) errors.push("stepId é obrigatório");
    if (seen.has(step.stepId)) errors.push("stepId duplicado");
    seen.add(step.stepId);
    if (index === 0 && step?.capability !== request.capability) {
      errors.push("capability inicial do plano diverge do request");
    }
    if (step?.input === null || typeof step?.input !== "object" || Array.isArray(step.input)) {
      errors.push("input do passo deve ser objeto");
    }
  }

  return errors;
}
