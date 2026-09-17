import {
  createMemoryRuntimeStatus,
  type MemoryBudget,
} from "../contracts/memory";
import type {
  MemoryPort,
  MemoryPreparationResult,
} from "../ports/memory-port";

export function createReadOnlyMemory(
  budget: MemoryBudget
): MemoryPort {
  const status = createMemoryRuntimeStatus(budget);

  return {
    budget,
    status,
    async prepare({ tenantId, context }): Promise<MemoryPreparationResult> {
      if (
        tenantId.trim() === "" ||
        context.tenantId !== tenantId ||
        context.organizationId !== tenantId
      ) {
        throw new Error("memory context pertence a outro tenant");
      }

      const activeEntries = context.memoryEntries.filter(
        (entry) => entry.status === "active"
      );
      const selected = activeEntries.slice(0, budget.maxEntries);
      const truncated =
        context.truncated.memoryEntries ||
        activeEntries.length > budget.maxEntries;

      return {
        context: {
          ...context,
          memoryEntries: selected,
          truncated: {
            ...context.truncated,
            memoryEntries: truncated,
          },
        },
        selectedCount: selected.length,
        truncated,
        status,
      };
    },
  };
}
