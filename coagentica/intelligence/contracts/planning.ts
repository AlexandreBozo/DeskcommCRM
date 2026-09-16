import type { IntelligenceRequest } from "../contracts";

export type PlanningStrategy = "direct";

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
  if (plan?.strategy !== "direct") errors.push("strategy de planejamento não suportada");

  if (!Array.isArray(plan?.steps) || plan.steps.length !== 1) {
    errors.push("planning direct exige exatamente um passo");
    return errors;
  }

  const step = plan.steps[0];
  if (!nonEmpty(step?.stepId)) errors.push("stepId é obrigatório");
  if (step?.capability !== request.capability) {
    errors.push("capability do plano diverge do request");
  }
  if (step?.input === null || typeof step?.input !== "object" || Array.isArray(step.input)) {
    errors.push("input do passo deve ser objeto");
  }

  return errors;
}
