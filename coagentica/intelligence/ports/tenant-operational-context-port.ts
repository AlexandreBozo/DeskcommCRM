import type { TenantContext } from "@/coagentica/foundation/contracts/tenancy";

/**
 * Projeção read-only do estado operacional consumida pela Intelligence.
 *
 * Este módulo é propositalmente estrutural: NÃO importa Tenant Runtime,
 * Operations Kernel, Deskcomm, Supabase, orquestradores externos ou SDKs de IA.
 */
export interface OperationalContextLimits {
  readonly maxEntities?: number;
  readonly maxRelationships?: number;
  readonly maxKnowledgeSources?: number;
  readonly maxMemoryEntries?: number;
  readonly maxGoals?: number;
  readonly maxCapabilities?: number;
}

/**
 * Seleção explícita das fatias operacionais que podem sair do Tenant Runtime.
 * O default é deny-by-default: sem seleção, nenhuma fatia sensível é exposta.
 */
export interface OperationalContextSelection {
  readonly includeEntities?: boolean;
  readonly includeRelationships?: boolean;
  readonly includeKnowledgeSources?: boolean;
  readonly includeMemoryEntries?: boolean;
  readonly includeGoals?: boolean;
  readonly includeCapabilities?: boolean;
  readonly entityIds?: readonly string[];
  readonly relationshipEntityIds?: readonly string[];
  readonly knowledgeSourceIds?: readonly string[];
  readonly memoryEntryIds?: readonly string[];
  readonly goalIds?: readonly string[];
  readonly capabilityIds?: readonly string[];
}

export interface OperationalEntityView {
  readonly entityId: string;
  readonly entityKind: string;
  readonly version: number;
  readonly data: Readonly<Record<string, unknown>>;
  readonly updatedAt: string;
  readonly source: string;
}

export interface OperationalRelationshipView {
  readonly sourceEntityId: string;
  readonly targetEntityId: string;
  readonly relationshipType: string;
  readonly sourceRole?: string;
  readonly targetRole?: string;
}

export interface OperationalKnowledgeView {
  readonly sourceId: string;
  readonly name: string;
  readonly type: string;
  readonly status: string;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface OperationalMemoryView {
  readonly entryId: string;
  readonly type: string;
  readonly content: string;
  readonly status: string;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface OperationalGoalView {
  readonly goalId: string;
  readonly name: string;
  readonly description: string;
  readonly status: string;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface OperationalCapabilityView {
  readonly capabilityId: string;
  readonly name: string;
  readonly type: string;
  readonly status: string;
  readonly config: Readonly<Record<string, unknown>>;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface OperationalContextTruncation {
  readonly entities: boolean;
  readonly relationships: boolean;
  readonly knowledgeSources: boolean;
  readonly memoryEntries: boolean;
  readonly goals: boolean;
  readonly capabilities: boolean;
}

export interface TenantOperationalContextQuery {
  readonly tenantContext: TenantContext;
  readonly selection?: OperationalContextSelection;
  readonly limits?: OperationalContextLimits;
}

export interface TenantOperationalContextView {
  readonly tenantId: string;
  readonly organizationId: string;
  readonly sourceVersion: number;
  readonly snapshotAt: string;
  readonly entities: readonly OperationalEntityView[];
  readonly relationships: readonly OperationalRelationshipView[];
  readonly knowledgeSources: readonly OperationalKnowledgeView[];
  readonly memoryEntries: readonly OperationalMemoryView[];
  readonly goals: readonly OperationalGoalView[];
  readonly capabilities: readonly OperationalCapabilityView[];
  readonly truncated: OperationalContextTruncation;
}

export interface TenantOperationalContextPort {
  loadOperationalContext(
    query: TenantOperationalContextQuery
  ): Promise<TenantOperationalContextView>;
}
