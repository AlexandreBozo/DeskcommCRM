import { describe, expect, it } from "vitest";
import {
  createActorContext,
  createTenantContext,
} from "@/coagentica/foundation/contracts/tenancy";
import { createIntelligenceRequest } from "@/coagentica/intelligence/contracts";
import {
  validateExecutionPlan,
  type ExecutionPlan,
} from "@/coagentica/intelligence/contracts/planning";

function request() {
  const tenantContext = createTenantContext({
    tenantId: "tenant-1",
    organizationId: "tenant-1",
    organizationName: "Tenant 1",
    role: "viewer",
    visibilityMode: "all",
    locale: "pt-BR",
    timezone: "America/Sao_Paulo",
    isPlatformAdmin: false,
  });
  const actorContext = createActorContext({
    actorId: "11111111-1111-4111-8111-111111111111",
    actorType: "human",
    tenantContext,
    correlationId: "corr-1",
  });
  return createIntelligenceRequest({
    requestId: "req-1",
    tenantContext,
    actorContext,
    capability: "system.runtime.info",
    input: { a: 1 },
  });
}

function directPlan(): ExecutionPlan {
  const req = request();
  return {
    planId: "req-1-plan",
    requestId: req.requestId,
    tenantId: req.tenantContext.tenantId,
    actorId: req.actorContext.actorId,
    strategy: "direct",
    steps: [
      {
        stepId: "req-1-step-1",
        capability: req.capability,
        input: req.input as Record<string, unknown>,
        metadata: {},
      },
    ],
    metadata: { version: "v0.9" },
  };
}

describe("planning contract", () => {
  it("aceita plano direct canônico de um passo", () => {
    expect(validateExecutionPlan(directPlan(), request())).toEqual([]);
  });

  it("rejeita plano que troca tenant, actor ou capability", () => {
    const plan = directPlan();
    const invalid = {
      ...plan,
      tenantId: "tenant-2",
      actorId: "actor-2",
      steps: [{ ...plan.steps[0]!, capability: "outra.capability" }],
    };
    const errors = validateExecutionPlan(invalid, request());

    expect(errors).toEqual(
      expect.arrayContaining([
        "tenantId do plano diverge do request",
        "actorId do plano diverge do request",
        "capability inicial do plano diverge do request",
      ]),
    );
  });

  it("rejeita plano direct com múltiplos passos", () => {
    const plan = directPlan();
    const invalid = {
      ...plan,
      steps: [plan.steps[0]!, { ...plan.steps[0]!, stepId: "req-1-step-2" }],
    };

    expect(validateExecutionPlan(invalid, request())).toContain(
      "planning single-step exige exatamente um passo",
    );
  });
});
