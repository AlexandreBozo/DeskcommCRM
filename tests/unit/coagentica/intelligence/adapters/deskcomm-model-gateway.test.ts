import { beforeEach, describe, expect, it, vi } from "vitest";

import { createActorContext, createTenantContext } from "@/coagentica/foundation/contracts/tenancy";
import { createModelGenerationRequest } from "@/coagentica/intelligence/contracts/model-gateway";

vi.mock("@/lib/ai/gateway", () => ({
  DEFAULT_BOT_MODEL: "internal/balanced",
  DEFAULT_CLASSIFIER_MODEL: "internal/fast",
  gatewayConfig: vi.fn(() => null),
  gatewayHeaders: vi.fn(({ organizationId }: { organizationId: string }) => ({
    "X-AI-Gateway-Tenant-Id": organizationId,
    "X-AI-Gateway-Zero-Retention": "1",
  })),
  resolveLanguageModel: vi.fn(() => null),
}));

vi.mock("ai", () => ({
  generateText: vi.fn(),
}));

import {
  createDeskcommModelGateway,
  ModelGatewayBoundaryError,
} from "@/coagentica/intelligence/adapters/deskcomm-model-gateway";
import { generateText } from "ai";
import { gatewayConfig, gatewayHeaders, resolveLanguageModel } from "@/lib/ai/gateway";

function tenant(id: string) {
  return createTenantContext({
    tenantId: id,
    organizationId: id,
    organizationName: id,
    role: "viewer",
    visibilityMode: "all",
    locale: "pt-BR",
    timezone: "America/Sao_Paulo",
    isPlatformAdmin: false,
  });
}

function request(tenantId = "tenant-1", actorTenantId = tenantId) {
  const tenantContext = tenant(tenantId);
  const actorContext = createActorContext({
    actorId: "11111111-1111-4111-8111-111111111111",
    actorType: "human",
    tenantContext: tenant(actorTenantId),
    correlationId: "corr-1",
  });
  return createModelGenerationRequest({
    requestId: "req-1",
    tenantContext,
    actorContext,
    profile: "balanced",
    prompt: "resuma o contexto",
  });
}

describe("Deskcomm Model Gateway adapter", () => {
  beforeEach(() => {
    vi.mocked(resolveLanguageModel).mockReset().mockReturnValue(null);
    vi.mocked(gatewayConfig).mockReset().mockReturnValue(null);
    vi.mocked(gatewayHeaders)
      .mockReset()
      .mockImplementation(({ organizationId }) => ({
        "X-AI-Gateway-Tenant-Id": organizationId,
        "X-AI-Gateway-Zero-Retention": "1",
      }));
    vi.mocked(generateText).mockReset();
  });

  it("falha fechado como unavailable quando não há rota de modelo configurada", async () => {
    const gateway = createDeskcommModelGateway();
    const status = await gateway.status();
    const result = await gateway.generate(request());

    expect(status).toEqual({ available: false, profiles: [] });
    expect(result).toEqual({
      status: "unavailable",
      reason: "model_gateway_unconfigured",
      usage: {},
      metadata: { profile: "balanced" },
    });
    expect(resolveLanguageModel).toHaveBeenCalledWith("internal/balanced");
    expect(generateText).not.toHaveBeenCalled();
  });

  it("bloqueia cross-tenant antes de resolver ou chamar modelo", async () => {
    const gateway = createDeskcommModelGateway();

    await expect(gateway.generate(request("tenant-1", "tenant-2"))).rejects.toBeInstanceOf(
      ModelGatewayBoundaryError,
    );
    expect(resolveLanguageModel).not.toHaveBeenCalled();
    expect(generateText).not.toHaveBeenCalled();
  });

  it("não expõe provider ou model id no contrato de resultado", async () => {
    const gateway = createDeskcommModelGateway();
    const result = await gateway.generate(request());
    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain("internal/balanced");
    expect(serialized).not.toContain("internal/fast");
    expect(serialized).not.toContain("provider");
    expect(serialized).not.toContain("modelId");
  });

  it("propaga tenant e zero-retention apenas quando usa o AI Gateway", async () => {
    vi.mocked(resolveLanguageModel).mockReturnValue({} as never);
    vi.mocked(gatewayConfig).mockReturnValue({ apiKey: "configured" });
    vi.mocked(generateText).mockResolvedValue({
      text: "ok",
      finishReason: "stop",
      usage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 },
    } as never);

    const gateway = createDeskcommModelGateway();
    const result = await gateway.generate(request());

    expect(gatewayHeaders).toHaveBeenCalledWith({ organizationId: "tenant-1" });
    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: {
          "X-AI-Gateway-Tenant-Id": "tenant-1",
          "X-AI-Gateway-Zero-Retention": "1",
        },
      }),
    );
    expect(result).toMatchObject({ status: "completed", text: "ok" });
  });

  it("não devolve erro bruto do provider pelo contrato canônico", async () => {
    vi.mocked(resolveLanguageModel).mockReturnValue({} as never);
    vi.mocked(generateText).mockRejectedValue(
      new Error("anthropic/secret-model provider credential invalid"),
    );

    const gateway = createDeskcommModelGateway();
    const result = await gateway.generate(request());

    expect(result).toEqual({
      status: "failed",
      reason: "model_gateway_failed",
      usage: {},
      metadata: { profile: "balanced" },
    });
    expect(JSON.stringify(result)).not.toContain("secret-model");
    expect(JSON.stringify(result)).not.toContain("credential invalid");
  });
});
