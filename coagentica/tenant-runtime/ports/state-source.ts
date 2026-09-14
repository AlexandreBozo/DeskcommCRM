import type {
  EntityRef,
  EntitySnapshot,
  RelationshipRef,
} from "@/coagentica/operations-kernel/contracts/entity";
import type {
  CapabilityType,
  GoalStatus,
  MemoryEntryType,
  TenantCapability,
  TenantGoal,
  TenantKnowledgeSource,
  TenantMemoryEntry,
  TenantStateSnapshot,
} from "../contracts/state";

/**
 * Ports de leitura do Tenant Operations Core.
 *
 * Tenant Runtime pode depender dos contratos do Operations Kernel, mas não de
 * Deskcomm/@lib. Implementações concretas vivem em integrations/.
 */
export interface EntityReadPort {
  getByRef(ref: EntityRef): Promise<EntitySnapshot | null>;
  getByTenant(tenantId: string, entityKind?: string): Promise<readonly EntitySnapshot[]>;
  listRefs(tenantId: string): Promise<readonly EntityRef[]>;
  listRelationships(tenantId: string, entityId?: string): Promise<readonly RelationshipRef[]>;
}

export interface KnowledgeReadPort {
  getSource(sourceId: string, tenantId: string): Promise<TenantKnowledgeSource | null>;
  listSources(tenantId: string): Promise<readonly TenantKnowledgeSource[]>;
}

export interface MemoryReadPort {
  getEntry(entryId: string, tenantId: string): Promise<TenantMemoryEntry | null>;
  listEntries(tenantId: string): Promise<readonly TenantMemoryEntry[]>;
  listEntriesByType(
    tenantId: string,
    type: MemoryEntryType
  ): Promise<readonly TenantMemoryEntry[]>;
}

export interface GoalReadPort {
  getGoal(goalId: string, tenantId: string): Promise<TenantGoal | null>;
  listGoals(tenantId: string): Promise<readonly TenantGoal[]>;
  listGoalsByStatus(
    tenantId: string,
    status: GoalStatus
  ): Promise<readonly TenantGoal[]>;
}

export interface CapabilityReadPort {
  getCapability(capabilityId: string, tenantId: string): Promise<TenantCapability | null>;
  listCapabilities(tenantId: string): Promise<readonly TenantCapability[]>;
  listCapabilitiesByType(
    tenantId: string,
    type: CapabilityType
  ): Promise<readonly TenantCapability[]>;
}

export interface TenantStateSourceData {
  readonly tenantId: string;
  readonly entities: readonly EntitySnapshot[];
  readonly relationships: readonly RelationshipRef[];
  readonly knowledgeSources: readonly TenantKnowledgeSource[];
  readonly memoryEntries: readonly TenantMemoryEntry[];
  readonly goals: readonly TenantGoal[];
  readonly capabilities: readonly TenantCapability[];
  readonly sourceVersion?: number;
}

/**
 * Porta mínima para hidratar o estado operacional de um tenant.
 * Implementações concretas vivem em integrations/ e nunca no Tenant Runtime.
 */
export interface TenantStateSourcePort {
  loadTenantState(tenantId: string): Promise<TenantStateSourceData>;
}

export interface StateSnapshotReadPort {
  getSnapshot(tenantId: string): Promise<TenantStateSnapshot | null>;
  getSnapshotVersion(tenantId: string): Promise<number>;
}

export interface TenantStateReadPort {
  readonly entities: EntityReadPort;
  readonly knowledge: KnowledgeReadPort;
  readonly memory: MemoryReadPort;
  readonly goals: GoalReadPort;
  readonly capabilities: CapabilityReadPort;
  readonly snapshot: StateSnapshotReadPort;
}
