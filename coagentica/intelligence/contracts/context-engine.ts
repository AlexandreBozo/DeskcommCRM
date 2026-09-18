import type { TenantOperationalContextView } from "../ports/tenant-operational-context-port";

export interface ContextEngineBudget {
  readonly maxEntities: number;
  readonly maxRelationships: number;
  readonly maxKnowledgeSources: number;
  readonly maxMemoryEntries: number;
  readonly maxGoals: number;
  readonly maxCapabilities: number;
}

export interface ContextEngineStatus {
  readonly version: "v0.15";
  readonly mode: "bounded-relevance";
  readonly budget: ContextEngineBudget;
}

export interface ContextPreparationResult {
  readonly context: TenantOperationalContextView | null;
  readonly selected: {
    readonly entities: number;
    readonly relationships: number;
    readonly knowledgeSources: number;
    readonly memoryEntries: number;
    readonly goals: number;
    readonly capabilities: number;
  };
  readonly truncated: boolean;
}

export function createContextEngineBudget(
  params: Partial<ContextEngineBudget> = {}
): ContextEngineBudget {
  const budget: ContextEngineBudget = {
    maxEntities: params.maxEntities ?? 20,
    maxRelationships: params.maxRelationships ?? 30,
    maxKnowledgeSources: params.maxKnowledgeSources ?? 8,
    maxMemoryEntries: params.maxMemoryEntries ?? 12,
    maxGoals: params.maxGoals ?? 5,
    maxCapabilities: params.maxCapabilities ?? 20,
  };
  for (const [name, value] of Object.entries(budget)) {
    if (!Number.isInteger(value) || value < 0) {
      throw new Error(`${name} deve ser inteiro não-negativo`);
    }
  }
  return budget;
}
