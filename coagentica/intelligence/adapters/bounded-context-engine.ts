import type { IntelligenceRequest } from "../contracts";
import {
  createContextEngineBudget,
  type ContextEngineBudget,
  type ContextPreparationResult,
} from "../contracts/context-engine";
import type { ContextEnginePort } from "../ports/context-engine-port";
import type { TenantOperationalContextView } from "../ports/tenant-operational-context-port";

function tokens(request: IntelligenceRequest): readonly string[] {
  const raw = `${request.capability} ${JSON.stringify(request.input)} ${JSON.stringify(request.metadata)}`.toLowerCase();
  return [...new Set(raw.split(/[^a-z0-9_.-]+/g).filter((item) => item.length >= 3))];
}

function score(value: unknown, query: readonly string[]): number {
  if (query.length === 0) return 0;
  const text = JSON.stringify(value).toLowerCase();
  return query.reduce((total, token) => total + (text.includes(token) ? 1 : 0), 0);
}

function select<T>(items: readonly T[], limit: number, query: readonly string[]): readonly T[] {
  if (limit === 0 || items.length === 0) return [];
  return items
    .map((item, index) => ({ item, index, score: score(item, query) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map(({ item }) => item);
}

function assertTenant(context: TenantOperationalContextView, tenantId: string): void {
  if (context.tenantId !== tenantId || context.organizationId !== tenantId) {
    throw new Error("context engine recebeu contexto de outro tenant");
  }
}

export function createBoundedContextEngine(
  budget: ContextEngineBudget = createContextEngineBudget()
): ContextEnginePort {
  const status = {
    version: "v0.15" as const,
    mode: "bounded-relevance" as const,
    budget,
  };

  return {
    status() {
      return status;
    },

    async prepare({ request, context }): Promise<ContextPreparationResult> {
      if (context === null) {
        return {
          context: null,
          selected: {
            entities: 0,
            relationships: 0,
            knowledgeSources: 0,
            memoryEntries: 0,
            goals: 0,
            capabilities: 0,
          },
          truncated: false,
        };
      }

      assertTenant(context, request.tenantContext.tenantId);
      const query = tokens(request);
      const entities = select(context.entities, budget.maxEntities, query);
      const entityIds = new Set(entities.map((item) => item.entityId));
      const relationships = select(
        context.relationships.filter(
          (item) => entityIds.size === 0 || entityIds.has(item.sourceEntityId) || entityIds.has(item.targetEntityId)
        ),
        budget.maxRelationships,
        query
      );
      const knowledgeSources = select(
        context.knowledgeSources.filter((item) => item.status === "active"),
        budget.maxKnowledgeSources,
        query
      );
      const memoryEntries = select(
        context.memoryEntries.filter((item) => item.status === "active"),
        budget.maxMemoryEntries,
        query
      );
      const goals = select(
        context.goals.filter((item) => item.status === "active"),
        budget.maxGoals,
        query
      );
      const capabilities = select(
        context.capabilities.filter((item) => item.status === "available"),
        budget.maxCapabilities,
        query
      );

      const truncated =
        entities.length < context.entities.length ||
        relationships.length < context.relationships.length ||
        knowledgeSources.length < context.knowledgeSources.filter((item) => item.status === "active").length ||
        memoryEntries.length < context.memoryEntries.filter((item) => item.status === "active").length ||
        goals.length < context.goals.filter((item) => item.status === "active").length ||
        capabilities.length < context.capabilities.filter((item) => item.status === "available").length;

      return {
        context: {
          ...context,
          entities,
          relationships,
          knowledgeSources,
          memoryEntries,
          goals,
          capabilities,
          truncated: {
            entities: context.truncated.entities || entities.length < context.entities.length,
            relationships: context.truncated.relationships || relationships.length < context.relationships.length,
            knowledgeSources: context.truncated.knowledgeSources || knowledgeSources.length < context.knowledgeSources.length,
            memoryEntries: context.truncated.memoryEntries || memoryEntries.length < context.memoryEntries.length,
            goals: context.truncated.goals || goals.length < context.goals.length,
            capabilities: context.truncated.capabilities || capabilities.length < context.capabilities.length,
          },
        },
        selected: {
          entities: entities.length,
          relationships: relationships.length,
          knowledgeSources: knowledgeSources.length,
          memoryEntries: memoryEntries.length,
          goals: goals.length,
          capabilities: capabilities.length,
        },
        truncated,
      };
    },
  };
}
