import type { ExecutionPlan } from "../contracts/planning";
import type { PlanningPort } from "../ports/planning-port";

/**
 * Planner nativo v0.9.
 *
 * Produz um único passo exatamente equivalente à capability já autorizada.
 * Não usa modelo, não lê banco e não possui side effects. O runtime revalida
 * tenant, actor, capability e hash do input antes de executar.
 */
function stringList(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim() !== "");
}

/**
 * Planner goal-aware v0.14/v0.16.
 *
 * Sem goals ativos preserva o comportamento direct do v0.9. Com goals ativos,
 * ancora o plano ao primeiro goal. Multi-step só nasce de capabilitySequence
 * declarada no metadata do goal e disponível no contexto do tenant, limitada a
 * três passos. O planner nunca inventa capability.
 */
export function createGoalAwarePlanner(): PlanningPort {
  return {
    async plan({ request, context }): Promise<ExecutionPlan> {
      const activeGoals = (context?.goals ?? []).filter((goal) => goal.status === "active");
      const primaryGoal = activeGoals[0];
      const available = new Set(
        (context?.capabilities ?? [])
          .filter((capability) => capability.status === "available")
          .flatMap((capability) => [capability.capabilityId, capability.name])
      );
      available.add(request.capability);

      const requestedSequence = primaryGoal
        ? stringList(primaryGoal.metadata.capabilitySequence)
        : [];
      const capabilities = [
        request.capability,
        ...requestedSequence.filter((capability) => capability !== request.capability && available.has(capability)),
      ].slice(0, 3);

      const multiStep = capabilities.length > 1;
      return {
        planId: `${request.requestId}-plan`,
        requestId: request.requestId,
        tenantId: request.tenantContext.tenantId,
        actorId: request.actorContext.actorId,
        strategy: multiStep ? "goal-aware-multi-step" : primaryGoal ? "goal-aware" : "direct",
        steps: capabilities.map((capability, index) => ({
          stepId: `${request.requestId}-step-${index + 1}`,
          capability,
          input: index === 0 ? request.input as Record<string, unknown> : {},
          metadata: {
            ...(primaryGoal ? { goalId: primaryGoal.goalId } : {}),
            source: index === 0 ? "request" : "goal",
          },
        })),
        metadata: {
          version: multiStep ? "v0.16" : primaryGoal ? "v0.14" : "v0.9",
          goalIds: activeGoals.map((goal) => goal.goalId),
          ...(primaryGoal ? { primaryGoalId: primaryGoal.goalId } : {}),
        },
      };
    },
  };
}

export function createDirectPlanner(): PlanningPort {
  return createGoalAwarePlanner();
}
