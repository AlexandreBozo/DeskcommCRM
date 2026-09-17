import { describe, expect, it } from "vitest";
import {
  createMemoryBudget,
  createMemoryRuntimeStatus,
} from "@/coagentica/intelligence/contracts/memory";

describe("memory v0.12 contract", () => {
  it("cria budget limitado e status estritamente read-only", () => {
    const budget = createMemoryBudget();
    expect(budget).toEqual({ maxEntries: 20 });
    expect(createMemoryRuntimeStatus(budget)).toEqual({
      version: "v0.12",
      mode: "read-only",
      writesEnabled: false,
      budget: { maxEntries: 20 },
    });
  });

  it("rejeita budgets fora do limite canônico", () => {
    expect(() => createMemoryBudget(0)).toThrow();
    expect(() => createMemoryBudget(101)).toThrow();
    expect(() => createMemoryBudget(1.5)).toThrow();
  });
});
