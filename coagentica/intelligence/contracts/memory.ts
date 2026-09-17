export interface MemoryBudget {
  readonly maxEntries: number;
}

export interface MemoryRuntimeStatus {
  readonly version: "v0.12";
  readonly mode: "read-only";
  readonly writesEnabled: false;
  readonly budget: MemoryBudget;
}

export function createMemoryBudget(maxEntries = 20): MemoryBudget {
  if (!Number.isInteger(maxEntries) || maxEntries < 1 || maxEntries > 100) {
    throw new Error("maxEntries deve ser inteiro entre 1 e 100");
  }
  return { maxEntries };
}

export function createMemoryRuntimeStatus(
  budget: MemoryBudget
): MemoryRuntimeStatus {
  return {
    version: "v0.12",
    mode: "read-only",
    writesEnabled: false,
    budget,
  };
}
