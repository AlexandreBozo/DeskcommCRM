import { generateText } from "ai";

import {
  DEFAULT_BOT_MODEL,
  DEFAULT_CLASSIFIER_MODEL,
  isAiGatewayConfigured,
  resolveLanguageModel,
  type ModelId,
} from "@/lib/ai/gateway";
import type {
  ModelGenerationRequest,
  ModelGenerationResult,
  ModelGenerationUsage,
  ModelProfile,
} from "@/coagentica/intelligence/contracts/model-gateway";
import type { ModelGatewayPort } from "@/coagentica/intelligence/ports/model-gateway-port";

export class ModelGatewayBoundaryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ModelGatewayBoundaryError";
  }
}

export interface DeskcommModelGatewayOptions {
  readonly modelByProfile?: Partial<Record<ModelProfile, ModelId>>;
}

const DEFAULT_MODEL_BY_PROFILE: Record<ModelProfile, ModelId> = {
  fast: DEFAULT_CLASSIFIER_MODEL,
  balanced: DEFAULT_BOT_MODEL,
  reasoning: DEFAULT_BOT_MODEL,
};

function assertTenantBoundary(request: ModelGenerationRequest): void {
  const tenant = request.tenantContext;
  const actorTenant = request.actorContext.tenantContext;
  if (
    !tenant.tenantId ||
    !tenant.organizationId ||
    !actorTenant?.tenantId ||
    !actorTenant.organizationId ||
    tenant.tenantId !== tenant.organizationId ||
    actorTenant.tenantId !== actorTenant.organizationId ||
    tenant.tenantId !== actorTenant.tenantId
  ) {
    throw new ModelGatewayBoundaryError("fronteira de tenant inválida no Model Gateway");
  }
}

function normalizeUsage(value: unknown): ModelGenerationUsage {
  if (value === null || typeof value !== "object") return {};
  const usage = value as Record<string, unknown>;
  const inputTokens = typeof usage.inputTokens === "number" ? usage.inputTokens : undefined;
  const outputTokens = typeof usage.outputTokens === "number" ? usage.outputTokens : undefined;
  const totalTokens = typeof usage.totalTokens === "number" ? usage.totalTokens : undefined;
  return {
    ...(inputTokens !== undefined && { inputTokens }),
    ...(outputTokens !== undefined && { outputTokens }),
    ...(totalTokens !== undefined && { totalTokens }),
  };
}

export function createDeskcommModelGateway(
  options: DeskcommModelGatewayOptions = {},
): ModelGatewayPort {
  const modelByProfile: Record<ModelProfile, ModelId> = {
    ...DEFAULT_MODEL_BY_PROFILE,
    ...(options.modelByProfile ?? {}),
  };

  return {
    async status() {
      const available = isAiGatewayConfigured();
      return {
        available,
        profiles: available ? (["fast", "balanced", "reasoning"] as const) : [],
      };
    },

    async generate(request): Promise<ModelGenerationResult> {
      assertTenantBoundary(request);

      const model = resolveLanguageModel(modelByProfile[request.profile]);
      if (model === null) {
        return {
          status: "unavailable",
          reason: "model_gateway_unconfigured",
          usage: {},
          metadata: { profile: request.profile },
        };
      }

      try {
        const result = await generateText({
          model,
          prompt: request.prompt,
          ...(request.system !== undefined && { system: request.system }),
          ...(request.temperature !== undefined && { temperature: request.temperature }),
          ...(request.maxOutputTokens !== undefined && {
            maxOutputTokens: request.maxOutputTokens,
          }),
        });

        return {
          status: "completed",
          text: result.text,
          finishReason: String(result.finishReason),
          usage: normalizeUsage(result.usage),
          metadata: { profile: request.profile },
        };
      } catch {
        return {
          status: "failed",
          reason: "model_gateway_failed",
          usage: {},
          metadata: { profile: request.profile },
        };
      }
    },
  };
}
