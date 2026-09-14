import {
  createTenantStateSnapshot,
  validateTenantStateSnapshot,
  type TenantStateSnapshot,
} from "../contracts/state";
import type { TenantStateSourcePort } from "../ports/state-source";

function requireTenantId(tenantId: string): string {
  const normalized = tenantId.trim();
  if (!normalized) {
    throw new Error("tenantId é obrigatório");
  }
  return normalized;
}

/**
 * Hidrata um snapshot canônico a partir de uma fonte operacional.
 *
 * O assembler é puro em relação à infraestrutura: não conhece Supabase,
 * Deskcomm, Hermes ou qualquer provider de IA.
 */
export async function assembleTenantState(
  source: TenantStateSourcePort,
  tenantId: string
): Promise<TenantStateSnapshot> {
  const normalizedTenantId = requireTenantId(tenantId);
  const data = await source.loadTenantState(normalizedTenantId);

  if (data.tenantId !== normalizedTenantId) {
    throw new Error("tenant state source retornou outro tenant");
  }

  const snapshot = createTenantStateSnapshot({
    tenantId: normalizedTenantId,
    entities: data.entities,
    relationships: data.relationships,
    knowledgeSources: data.knowledgeSources,
    memoryEntries: data.memoryEntries,
    goals: data.goals,
    capabilities: data.capabilities,
    version: data.sourceVersion ?? 1,
  });

  const errors = validateTenantStateSnapshot(snapshot);
  if (errors.length > 0) {
    throw new Error(`tenant state inválido: ${errors.join("; ")}`);
  }

  return snapshot;
}
