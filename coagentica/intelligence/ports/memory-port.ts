import type {
  MemoryBudget,
  MemoryRuntimeStatus,
} from "../contracts/memory";
import type {
  TenantOperationalContextView,
} from "./tenant-operational-context-port";

export interface MemoryPreparationResult {
  readonly context: TenantOperationalContextView;
  readonly selectedCount: number;
  readonly truncated: boolean;
  readonly status: MemoryRuntimeStatus;
}

/**
 * Memória operacional canônica em modo read-only.
 *
 * A porta só projeta memória já autorizada e carregada no contexto do tenant.
 * Não persiste, não cria fatos e não acessa providers/modelos.
 */
export interface MemoryPort {
  prepare(input: {
    readonly tenantId: string;
    readonly context: TenantOperationalContextView;
  }): Promise<MemoryPreparationResult>;
  readonly budget: MemoryBudget;
  readonly status: MemoryRuntimeStatus;
}
