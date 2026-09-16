import type { IntelligenceRequest } from "../contracts";
import type { ExecutionPlan } from "../contracts/planning";
import type { TenantOperationalContextView } from "./tenant-operational-context-port";

export interface PlanningInput {
  readonly request: IntelligenceRequest;
  readonly context: TenantOperationalContextView | null;
}

/**
 * Fronteira canônica de planejamento da Coagentica.
 *
 * A porta não conhece provider/model, adapters, banco, orquestradores legados ou canais.
 * Implementações podem evoluir de planejamento determinístico para modelos
 * nativos sem alterar o Intelligence Runtime.
 */
export interface PlanningPort {
  plan(input: PlanningInput): Promise<ExecutionPlan>;
}
