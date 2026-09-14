import type { CapabilityInvocation, IntelligenceRequest } from "../contracts";
import type { TenantOperationalContextView } from "./tenant-operational-context-port";

/**
 * Entrada do executor de capacidade (v0.5).
 *
 * `context` é nulo quando a política autorizou a execução sem autorizar
 * nenhuma fatia operacional — o runtime pula a leitura nesse caso.
 */
export interface CapabilityExecuteInput {
  readonly request: IntelligenceRequest;
  readonly invocation: CapabilityInvocation;
  readonly context: TenantOperationalContextView | null;
}

/**
 * Porta de execução de capacidade (v0.5).
 *
 * A implementação concreta (ferramenta, modelo, workflow) vive fora do
 * runtime, atrás desta porta. Falha do executor (throw ou status
 * diferente de `completed`) vira `escalate` por falha fechada.
 *
 * Este módulo é propositalmente estrutural: NÃO importa adapters,
 * tenant-runtime, operations-kernel, Deskcomm, Supabase ou SDKs de IA.
 */
export interface CapabilityExecutorPort {
  execute(input: CapabilityExecuteInput): Promise<CapabilityInvocation>;
}
