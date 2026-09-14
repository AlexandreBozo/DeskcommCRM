import type {
  EntitySnapshot,
  RelationshipRef,
} from "@/coagentica/operations-kernel/contracts/entity";

/**
 * Estado lógico isolado de um Tenant Operations Core.
 *
 * Este módulo não persiste nada. Ele define o shape canônico que o runtime
 * monta a partir de fontes existentes (Deskcomm hoje, outras integrações amanhã).
 * Todo item carregado precisa permanecer tenant-bound.
 */

export type KnowledgeSourceType =
  | "document"
  | "faq"
  | "policy"
  | "catalog"
  | "conversation"
  | "integration"
  | "other";

export type KnowledgeSourceStatus =
  | "active"
  | "inactive"
  | "processing"
  | "failed";

export interface TenantKnowledgeSource {
  readonly sourceId: string;
  readonly tenantId: string;
  readonly name: string;
  readonly type: KnowledgeSourceType;
  readonly status: KnowledgeSourceStatus;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type MemoryEntryType =
  | "fact"
  | "preference"
  | "interaction"
  | "insight"
  | "note";

export type MemoryEntryStatus = "active" | "archived" | "pending";

export interface TenantMemoryEntry {
  readonly entryId: string;
  readonly tenantId: string;
  readonly type: MemoryEntryType;
  readonly content: string;
  readonly metadata: Record<string, unknown>;
  readonly status: MemoryEntryStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type GoalStatus = "draft" | "active" | "completed" | "archived";

/**
 * Goals ainda não possuem persistência Deskcomm canônica.
 * O contrato existe para o Tenant Operations Core, mas não há adapter sintético.
 */
export interface TenantGoal {
  readonly goalId: string;
  readonly tenantId: string;
  readonly name: string;
  readonly description: string;
  readonly status: GoalStatus;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly completedAt?: string;
}

export type CapabilityType =
  | "ai_model"
  | "workflow"
  | "integration"
  | "channel"
  | "tool";

export type CapabilityStatus = "available" | "unavailable" | "degraded";

export interface TenantCapability {
  readonly capabilityId: string;
  readonly tenantId: string;
  readonly name: string;
  readonly type: CapabilityType;
  readonly status: CapabilityStatus;
  readonly config: Record<string, unknown>;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface TenantStateSnapshot {
  readonly tenantId: string;
  readonly entities: readonly EntitySnapshot[];
  readonly relationships: readonly RelationshipRef[];
  readonly knowledgeSources: readonly TenantKnowledgeSource[];
  readonly memoryEntries: readonly TenantMemoryEntry[];
  readonly goals: readonly TenantGoal[];
  readonly capabilities: readonly TenantCapability[];
  readonly version: number;
  readonly snapshotAt: string;
}

function isNonBlank(value: string): value is string {
  return typeof value === "string" && value.trim() !== "";
}

function nowIso(): string {
  return new Date().toISOString();
}

function timestampOrNow(value?: string): string {
  return value && value.trim() !== "" ? value : nowIso();
}

export function createKnowledgeSource(params: {
  sourceId: string;
  tenantId: string;
  name: string;
  type: KnowledgeSourceType;
  status?: KnowledgeSourceStatus;
  metadata?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}): TenantKnowledgeSource {
  if (!isNonBlank(params.sourceId)) throw new Error("sourceId é obrigatório");
  if (!isNonBlank(params.tenantId)) throw new Error("tenantId é obrigatório");
  if (!isNonBlank(params.name)) throw new Error("name é obrigatório");

  const createdAt = timestampOrNow(params.createdAt);
  return {
    sourceId: params.sourceId.trim(),
    tenantId: params.tenantId.trim(),
    name: params.name.trim(),
    type: params.type,
    status: params.status ?? "active",
    metadata: params.metadata ? { ...params.metadata } : {},
    createdAt,
    updatedAt: timestampOrNow(params.updatedAt ?? createdAt),
  };
}

export function updateKnowledgeSource(
  source: TenantKnowledgeSource,
  updates: Partial<
    Pick<TenantKnowledgeSource, "name" | "status" | "metadata">
  >
): TenantKnowledgeSource {
  return {
    ...source,
    ...updates,
    metadata: updates.metadata ? { ...updates.metadata } : source.metadata,
    updatedAt: nowIso(),
  };
}

export function createMemoryEntry(params: {
  entryId: string;
  tenantId: string;
  type: MemoryEntryType;
  content: string;
  status?: MemoryEntryStatus;
  metadata?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}): TenantMemoryEntry {
  if (!isNonBlank(params.entryId)) throw new Error("entryId é obrigatório");
  if (!isNonBlank(params.tenantId)) throw new Error("tenantId é obrigatório");
  if (!isNonBlank(params.content)) throw new Error("content é obrigatório");

  const createdAt = timestampOrNow(params.createdAt);
  return {
    entryId: params.entryId.trim(),
    tenantId: params.tenantId.trim(),
    type: params.type,
    content: params.content.trim(),
    status: params.status ?? "active",
    metadata: params.metadata ? { ...params.metadata } : {},
    createdAt,
    updatedAt: timestampOrNow(params.updatedAt ?? createdAt),
  };
}

export function addMemoryEntry(
  entries: readonly TenantMemoryEntry[],
  entry: TenantMemoryEntry
): readonly TenantMemoryEntry[] {
  return [...entries, entry];
}

export function createGoal(params: {
  goalId: string;
  tenantId: string;
  name: string;
  description?: string;
  status?: GoalStatus;
  metadata?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}): TenantGoal {
  if (!isNonBlank(params.goalId)) throw new Error("goalId é obrigatório");
  if (!isNonBlank(params.tenantId)) throw new Error("tenantId é obrigatório");
  if (!isNonBlank(params.name)) throw new Error("name é obrigatório");

  const createdAt = timestampOrNow(params.createdAt);
  return {
    goalId: params.goalId.trim(),
    tenantId: params.tenantId.trim(),
    name: params.name.trim(),
    description: params.description?.trim() ?? "",
    status: params.status ?? "draft",
    metadata: params.metadata ? { ...params.metadata } : {},
    createdAt,
    updatedAt: timestampOrNow(params.updatedAt ?? createdAt),
  };
}

export function completeGoal(goal: TenantGoal): TenantGoal {
  const completedAt = nowIso();
  return {
    ...goal,
    status: "completed",
    completedAt,
    updatedAt: completedAt,
  };
}

export function createCapability(params: {
  capabilityId: string;
  tenantId: string;
  name: string;
  type: CapabilityType;
  status?: CapabilityStatus;
  config?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}): TenantCapability {
  if (!isNonBlank(params.capabilityId)) {
    throw new Error("capabilityId é obrigatório");
  }
  if (!isNonBlank(params.tenantId)) throw new Error("tenantId é obrigatório");
  if (!isNonBlank(params.name)) throw new Error("name é obrigatório");

  const createdAt = timestampOrNow(params.createdAt);
  return {
    capabilityId: params.capabilityId.trim(),
    tenantId: params.tenantId.trim(),
    name: params.name.trim(),
    type: params.type,
    status: params.status ?? "available",
    config: params.config ? { ...params.config } : {},
    metadata: params.metadata ? { ...params.metadata } : {},
    createdAt,
    updatedAt: timestampOrNow(params.updatedAt ?? createdAt),
  };
}

export function createTenantStateSnapshot(params: {
  tenantId: string;
  entities?: readonly EntitySnapshot[];
  relationships?: readonly RelationshipRef[];
  knowledgeSources?: readonly TenantKnowledgeSource[];
  memoryEntries?: readonly TenantMemoryEntry[];
  goals?: readonly TenantGoal[];
  capabilities?: readonly TenantCapability[];
  version?: number;
  snapshotAt?: string;
}): TenantStateSnapshot {
  if (!isNonBlank(params.tenantId)) throw new Error("tenantId é obrigatório");

  return {
    tenantId: params.tenantId.trim(),
    entities: [...(params.entities ?? [])],
    relationships: [...(params.relationships ?? [])],
    knowledgeSources: [...(params.knowledgeSources ?? [])],
    memoryEntries: [...(params.memoryEntries ?? [])],
    goals: [...(params.goals ?? [])],
    capabilities: [...(params.capabilities ?? [])],
    version: params.version ?? 1,
    snapshotAt: timestampOrNow(params.snapshotAt),
  };
}

function bumpSnapshot(
  snapshot: TenantStateSnapshot,
  patch: Partial<
    Pick<
      TenantStateSnapshot,
      | "entities"
      | "relationships"
      | "knowledgeSources"
      | "memoryEntries"
      | "goals"
      | "capabilities"
    >
  >
): TenantStateSnapshot {
  return {
    ...snapshot,
    ...patch,
    version: snapshot.version + 1,
    snapshotAt: nowIso(),
  };
}

export function withEntities(
  snapshot: TenantStateSnapshot,
  entities: readonly EntitySnapshot[]
): TenantStateSnapshot {
  return bumpSnapshot(snapshot, { entities: [...entities] });
}

export function withRelationships(
  snapshot: TenantStateSnapshot,
  relationships: readonly RelationshipRef[]
): TenantStateSnapshot {
  return bumpSnapshot(snapshot, { relationships: [...relationships] });
}

export function withKnowledgeSources(
  snapshot: TenantStateSnapshot,
  sources: readonly TenantKnowledgeSource[]
): TenantStateSnapshot {
  return bumpSnapshot(snapshot, { knowledgeSources: [...sources] });
}

export function withMemoryEntries(
  snapshot: TenantStateSnapshot,
  entries: readonly TenantMemoryEntry[]
): TenantStateSnapshot {
  return bumpSnapshot(snapshot, { memoryEntries: [...entries] });
}

export function withGoals(
  snapshot: TenantStateSnapshot,
  goals: readonly TenantGoal[]
): TenantStateSnapshot {
  return bumpSnapshot(snapshot, { goals: [...goals] });
}

export function withCapabilities(
  snapshot: TenantStateSnapshot,
  capabilities: readonly TenantCapability[]
): TenantStateSnapshot {
  return bumpSnapshot(snapshot, { capabilities: [...capabilities] });
}

export function validateTenantStateSnapshot(
  snapshot: TenantStateSnapshot
): readonly string[] {
  const errors: string[] = [];

  if (!isNonBlank(snapshot.tenantId)) errors.push("tenantId é obrigatório");
  if (snapshot.version < 1) errors.push("version deve ser >= 1");

  if (Number.isNaN(new Date(snapshot.snapshotAt).getTime())) {
    errors.push("snapshotAt inválido");
  }

  for (const entity of snapshot.entities) {
    if (entity.ref.tenantId !== snapshot.tenantId) {
      errors.push(`entity ${entity.ref.entityId} pertence a outro tenant`);
    }
  }

  for (const relationship of snapshot.relationships) {
    if (relationship.tenantId !== snapshot.tenantId) {
      errors.push(
        `relationship ${relationship.sourceEntityId}:${relationship.relationshipType} pertence a outro tenant`
      );
    }
  }

  for (const source of snapshot.knowledgeSources) {
    if (source.tenantId !== snapshot.tenantId) {
      errors.push(`knowledgeSource ${source.sourceId} pertence a outro tenant`);
    }
  }

  for (const entry of snapshot.memoryEntries) {
    if (entry.tenantId !== snapshot.tenantId) {
      errors.push(`memoryEntry ${entry.entryId} pertence a outro tenant`);
    }
  }

  for (const goal of snapshot.goals) {
    if (goal.tenantId !== snapshot.tenantId) {
      errors.push(`goal ${goal.goalId} pertence a outro tenant`);
    }
  }

  for (const capability of snapshot.capabilities) {
    if (capability.tenantId !== snapshot.tenantId) {
      errors.push(`capability ${capability.capabilityId} pertence a outro tenant`);
    }
  }

  return errors;
}

export function isGoalTenantBound(
  goal: TenantGoal,
  tenantId: string
): boolean {
  return goal.tenantId === tenantId;
}

export function isTenantStateBound(
  snapshot: TenantStateSnapshot,
  tenantId: string
): boolean {
  return (
    snapshot.tenantId === tenantId &&
    validateTenantStateSnapshot(snapshot).length === 0
  );
}
