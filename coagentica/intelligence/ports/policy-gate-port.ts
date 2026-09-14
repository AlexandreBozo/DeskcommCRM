import type { IntelligenceRequest, PolicyConstraint } from "../contracts";
import type {
  OperationalContextLimits,
  OperationalContextSelection,
} from "./tenant-operational-context-port";

/**
 * Resultado do gate de política (v0.5).
 *
 * O gate retorna um `PolicyConstraint` estrutural próprio da Intelligence
 * mais a seleção/limites de contexto operacional que ele autoriza.
 * Sem seleção autorizada, o runtime NÃO lê contexto operacional.
 *
 * Este módulo é propositalmente estrutural: NÃO importa adapters,
 * tenant-runtime, operations-kernel, Deskcomm, Supabase ou SDKs de IA.
 */
export interface PolicyGateResult {
  readonly constraint: PolicyConstraint;
  readonly selection?: OperationalContextSelection;
  readonly limits?: OperationalContextLimits;
}

export interface PolicyGatePort {
  authorize(request: IntelligenceRequest): Promise<PolicyGateResult>;
}
