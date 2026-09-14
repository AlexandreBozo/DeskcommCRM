import type {
  OperationalContextLimits,
  OperationalContextSelection,
  TenantOperationalContextPort,
  TenantOperationalContextQuery,
  TenantOperationalContextView,
} from "../ports/tenant-operational-context-port";
import type { TenantStateSourcePort } from "@/coagentica/tenant-runtime/ports/state-source";
import { assembleTenantState } from "@/coagentica/tenant-runtime/assembler/tenant-state-assembler";

const DEFAULT_LIMITS = {
  maxEntities: 100,
  maxRelationships: 200,
  maxKnowledgeSources: 50,
  maxMemoryEntries: 50,
  maxGoals: 25,
  maxCapabilities: 50,
} as const;

const HARD_LIMITS = {
  maxEntities: 500,
  maxRelationships: 1000,
  maxKnowledgeSources: 250,
  maxMemoryEntries: 250,
  maxGoals: 100,
  maxCapabilities: 250,
} as const;

type NormalizedLimits = {
  [K in keyof typeof DEFAULT_LIMITS]: number;
};

function normalizeLimit(
  value: number | undefined,
  fallback: number,
  hardLimit: number
): number {
  if (value === undefined) return fallback;
  if (!Number.isFinite(value) || value < 0) {
    throw new Error("limite de contexto operacional inválido");
  }
  return Math.min(Math.floor(value), hardLimit);
}

function normalizeLimits(limits?: OperationalContextLimits): NormalizedLimits {
  return {
    maxEntities: normalizeLimit(
      limits?.maxEntities,
      DEFAULT_LIMITS.maxEntities,
      HARD_LIMITS.maxEntities
    ),
    maxRelationships: normalizeLimit(
      limits?.maxRelationships,
      DEFAULT_LIMITS.maxRelationships,
      HARD_LIMITS.maxRelationships
    ),
    maxKnowledgeSources: normalizeLimit(
      limits?.maxKnowledgeSources,
      DEFAULT_LIMITS.maxKnowledgeSources,
      HARD_LIMITS.maxKnowledgeSources
    ),
    maxMemoryEntries: normalizeLimit(
      limits?.maxMemoryEntries,
      DEFAULT_LIMITS.maxMemoryEntries,
      HARD_LIMITS.maxMemoryEntries
    ),
    maxGoals: normalizeLimit(
      limits?.maxGoals,
      DEFAULT_LIMITS.maxGoals,
      HARD_LIMITS.maxGoals
    ),
    maxCapabilities: normalizeLimit(
      limits?.maxCapabilities,
      DEFAULT_LIMITS.maxCapabilities,
      HARD_LIMITS.maxCapabilities
    ),
  };
}

function cloneRecord(
  value: Readonly<Record<string, unknown>>
): Record<string, unknown> {
  return structuredClone(value);
}

function selectedIds(values?: readonly string[]): ReadonlySet<string> | null {
  if (!values || values.length === 0) return null;
  return new Set(values.map((value) => value.trim()).filter(Boolean));
}

function isSelected(
  includeAll: boolean | undefined,
  ids: ReadonlySet<string> | null,
  id: string
): boolean {
  return includeAll === true || ids?.has(id) === true;
}

function normalizeSelection(selection?: OperationalContextSelection) {
  return {
    includeEntities: selection?.includeEntities === true,
    includeRelationships: selection?.includeRelationships === true,
    includeKnowledgeSources: selection?.includeKnowledgeSources === true,
    includeMemoryEntries: selection?.includeMemoryEntries === true,
    includeGoals: selection?.includeGoals === true,
    includeCapabilities: selection?.includeCapabilities === true,
    entityIds: selectedIds(selection?.entityIds),
    relationshipEntityIds: selectedIds(selection?.relationshipEntityIds),
    knowledgeSourceIds: selectedIds(selection?.knowledgeSourceIds),
    memoryEntryIds: selectedIds(selection?.memoryEntryIds),
    goalIds: selectedIds(selection?.goalIds),
    capabilityIds: selectedIds(selection?.capabilityIds),
  };
}

/** @internal Exportado apenas para teste de defesa em profundidade do adapter. */
export function assertOperationalSnapshotTenantBoundary(
  snapshot: Awaited<ReturnType<typeof assembleTenantState>>,
  tenantId: string
): void {
  if (snapshot.tenantId !== tenantId) {
    throw new Error("snapshot operacional pertence a outro tenant");
  }

  for (const entity of snapshot.entities) {
    if (entity.ref.tenantId !== tenantId) {
      throw new Error("snapshot operacional contém entidade de outro tenant");
    }
  }
  for (const relationship of snapshot.relationships) {
    if (relationship.tenantId !== tenantId) {
      throw new Error("snapshot operacional contém relação de outro tenant");
    }
  }
  for (const source of snapshot.knowledgeSources) {
    if (source.tenantId !== tenantId) {
      throw new Error("snapshot operacional contém conhecimento de outro tenant");
    }
  }
  for (const entry of snapshot.memoryEntries) {
    if (entry.tenantId !== tenantId) {
      throw new Error("snapshot operacional contém memória de outro tenant");
    }
  }
  for (const goal of snapshot.goals) {
    if (goal.tenantId !== tenantId) {
      throw new Error("snapshot operacional contém objetivo de outro tenant");
    }
  }
  for (const capability of snapshot.capabilities) {
    if (capability.tenantId !== tenantId) {
      throw new Error("snapshot operacional contém capability de outro tenant");
    }
  }
}

function requireCanonicalTenant(query: TenantOperationalContextQuery): {
  tenantId: string;
  organizationId: string;
} {
  const tenantId = query.tenantContext.tenantId.trim();
  const organizationId = query.tenantContext.organizationId.trim();

  if (!tenantId) throw new Error("tenantId é obrigatório");
  if (!organizationId) throw new Error("organizationId é obrigatório");
  if (organizationId !== tenantId) {
    throw new Error("tenantContext inconsistente: organizationId difere de tenantId");
  }

  return { tenantId, organizationId };
}

export function createTenantOperationalContextBridge(
  source: TenantStateSourcePort
): TenantOperationalContextPort {
  return {
    async loadOperationalContext(
      query: TenantOperationalContextQuery
    ): Promise<TenantOperationalContextView> {
      const { tenantId, organizationId } = requireCanonicalTenant(query);
      const limits = normalizeLimits(query.limits);
      const selection = normalizeSelection(query.selection);
      const snapshot = await assembleTenantState(source, tenantId);
      assertOperationalSnapshotTenantBoundary(snapshot, tenantId);

      const entities = snapshot.entities.filter((entity) =>
        isSelected(selection.includeEntities, selection.entityIds, entity.ref.entityId)
      );
      const knowledgeSources = snapshot.knowledgeSources.filter((sourceItem) =>
        isSelected(
          selection.includeKnowledgeSources,
          selection.knowledgeSourceIds,
          sourceItem.sourceId
        )
      );
      const memoryEntries = snapshot.memoryEntries.filter((entry) =>
        isSelected(
          selection.includeMemoryEntries,
          selection.memoryEntryIds,
          entry.entryId
        )
      );
      const capabilities = snapshot.capabilities.filter((capability) =>
        isSelected(
          selection.includeCapabilities,
          selection.capabilityIds,
          capability.capabilityId
        )
      );
      const goals = snapshot.goals.filter((goal) =>
        isSelected(selection.includeGoals, selection.goalIds, goal.goalId)
      );
      const relationships = snapshot.relationships.filter((relationship) => {
        if (selection.includeRelationships) return true;
        const ids = selection.relationshipEntityIds;
        return (
          ids?.has(relationship.sourceEntityId) === true ||
          ids?.has(relationship.targetEntityId) === true
        );
      });

      return {
        tenantId,
        organizationId,
        sourceVersion: snapshot.version,
        snapshotAt: snapshot.snapshotAt,
        entities: entities.slice(0, limits.maxEntities).map((entity) => ({
          entityId: entity.ref.entityId,
          entityKind: entity.ref.entityKind,
          version: entity.version,
          data: cloneRecord(entity.data),
          updatedAt: entity.updatedAt,
          source: entity.source,
        })),
        relationships: relationships
          .slice(0, limits.maxRelationships)
          .map((relationship) => ({
            sourceEntityId: relationship.sourceEntityId,
            targetEntityId: relationship.targetEntityId,
            relationshipType: relationship.relationshipType,
            sourceRole: relationship.sourceRole,
            targetRole: relationship.targetRole,
          })),
        knowledgeSources: knowledgeSources
          .slice(0, limits.maxKnowledgeSources)
          .map((sourceItem) => ({
            sourceId: sourceItem.sourceId,
            name: sourceItem.name,
            type: sourceItem.type,
            status: sourceItem.status,
            metadata: cloneRecord(sourceItem.metadata),
          })),
        memoryEntries: memoryEntries
          .slice(0, limits.maxMemoryEntries)
          .map((entry) => ({
            entryId: entry.entryId,
            type: entry.type,
            content: entry.content,
            status: entry.status,
            metadata: cloneRecord(entry.metadata),
          })),
        goals: goals.slice(0, limits.maxGoals).map((goal) => ({
          goalId: goal.goalId,
          name: goal.name,
          description: goal.description,
          status: goal.status,
          metadata: cloneRecord(goal.metadata),
        })),
        capabilities: capabilities
          .slice(0, limits.maxCapabilities)
          .map((capability) => ({
            capabilityId: capability.capabilityId,
            name: capability.name,
            type: capability.type,
            status: capability.status,
            config: cloneRecord(capability.config),
            metadata: cloneRecord(capability.metadata),
          })),
        truncated: {
          entities: entities.length > limits.maxEntities,
          relationships: relationships.length > limits.maxRelationships,
          knowledgeSources: knowledgeSources.length > limits.maxKnowledgeSources,
          memoryEntries: memoryEntries.length > limits.maxMemoryEntries,
          goals: goals.length > limits.maxGoals,
          capabilities: capabilities.length > limits.maxCapabilities,
        },
      };
    },
  };
}
