import { describe, expect, it } from "vitest";

import { createActorContext, createTenantContext } from "@/coagentica/foundation/contracts/tenancy";
import { createModelGenerationRequest } from "@/coagentica/intelligence/contracts/model-gateway";

const tenantContext = createTenantContext({
  tenantId: "tenant-1",
  organizationId: "tenant-1",
  organizationName: "Tenant",
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

describe("Model Gateway canonical contract", () => {
  it("aceita perfil canônico sem provider/model no request", () => {
    const request = createModelGenerationRequest({
      requestId: "req-1",
      tenantContext,
      actorContext,
      profile: "reasoning",
      prompt: "analise",
      metadata: { source: "test" },
    });

    expect(request.profile).toBe("reasoning");
    expect(JSON.stringify(request)).not.toMatch(/anthropic|openai|google|provider|modelId/);
  });

  it("recusa prompt vazio, temperatura inválida e limite inválido", () => {
    expect(() =>
      createModelGenerationRequest({
        requestId: "req-1",
        tenantContext,
        actorContext,
        profile: "fast",
        prompt: " ",
      }),
    ).toThrow("prompt é obrigatório");

    expect(() =>
      createModelGenerationRequest({
        requestId: "req-1",
        tenantContext,
        actorContext,
        profile: "fast",
        prompt: "x",
        temperature: 3,
      }),
    ).toThrow("temperature deve estar entre 0 e 2");

    expect(() =>
      createModelGenerationRequest({
        requestId: "req-1",
        tenantContext,
        actorContext,
        profile: "fast",
        prompt: "x",
        maxOutputTokens: 0,
      }),
    ).toThrow("maxOutputTokens deve ser inteiro positivo");
  });
});
