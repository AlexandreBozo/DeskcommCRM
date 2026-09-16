import { describe, expect, it } from "vitest";
import {
  createAgentExecutionBudget,
  createAgentRuntimeStatus,
} from "@/coagentica/intelligence/contracts/agent-runtime";

describe("Agent Runtime contract", () => {
  it("cria orçamento bounded e não autônomo por padrão", () => {
    const budget = createAgentExecutionBudget();
    expect(budget).toEqual({
      maxPlanSteps: 1,
      maxCapabilityInvocations: 1,
      maxModelCalls: 0,
      autonomous: false,
    });
    expect(createAgentRuntimeStatus(budget)).toEqual({
      version: "v0.10",
      mode: "bounded",
      budget,
    });
  });

  it("rejeita limites negativos ou fracionários", () => {
    expect(() => createAgentExecutionBudget({ maxPlanSteps: -1 })).toThrow();
    expect(() =>
      createAgentExecutionBudget({ maxCapabilityInvocations: 1.5 }),
    ).toThrow();
    expect(() => createAgentExecutionBudget({ maxModelCalls: -1 })).toThrow();
  });
});
