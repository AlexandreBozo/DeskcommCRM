import type { ExecutionPlan } from "../contracts/planning";
import type { PlanningPort } from "../ports/planning-port";

/**
 * Planner nativo v0.9.
 *
 * Produz um único passo exatamente equivalente à capability já autorizada.
 * Não usa modelo, não lê banco e não possui side effects. O runtime revalida
 * tenant, actor, capability e hash do input antes de executar.
 */
export function createDirectPlanner(): PlanningPort {
  return {
    async plan({ request }): Promise<ExecutionPlan> {
      return {
        planId: `${request.requestId}-plan`,
        requestId: request.requestId,
        tenantId: request.tenantContext.tenantId,
        actorId: request.actorContext.actorId,
        strategy: "direct",
        steps: [
          {
            stepId: `${request.requestId}-step-1`,
            capability: request.capability,
            input: request.input as Record<string, unknown>,
            metadata: {},
          },
        ],
        metadata: { version: "v0.9" },
      };
    },
  };
}
