import type { ActorContext, TenantContext } from "@/coagentica/foundation/contracts/tenancy";

export type ModelProfile = "fast" | "balanced" | "reasoning";

export interface ModelGenerationRequest {
  readonly requestId: string;
  readonly tenantContext: TenantContext;
  readonly actorContext: ActorContext;
  readonly profile: ModelProfile;
  readonly prompt: string;
  readonly system?: string;
  readonly temperature?: number;
  readonly maxOutputTokens?: number;
  readonly metadata: Record<string, unknown>;
}

export interface ModelGenerationUsage {
  readonly inputTokens?: number;
  readonly outputTokens?: number;
  readonly totalTokens?: number;
}

export interface ModelGenerationResult {
  readonly status: "completed" | "unavailable" | "failed";
  readonly text?: string;
  readonly reason?: string;
  readonly finishReason?: string;
  readonly usage: ModelGenerationUsage;
  readonly metadata: Record<string, unknown>;
}

export interface ModelGatewayStatus {
  readonly available: boolean;
  readonly profiles: readonly ModelProfile[];
}

export function createModelGenerationRequest(params: {
  requestId: string;
  tenantContext: TenantContext;
  actorContext: ActorContext;
  profile: ModelProfile;
  prompt: string;
  system?: string;
  temperature?: number;
  maxOutputTokens?: number;
  metadata?: Record<string, unknown>;
}): ModelGenerationRequest {
  if (!params.requestId || params.requestId.trim() === "") {
    throw new Error("requestId é obrigatório");
  }
  if (!params.prompt || params.prompt.trim() === "") {
    throw new Error("prompt é obrigatório");
  }
  if (
    params.temperature !== undefined &&
    (!Number.isFinite(params.temperature) || params.temperature < 0 || params.temperature > 2)
  ) {
    throw new Error("temperature deve estar entre 0 e 2");
  }
  if (
    params.maxOutputTokens !== undefined &&
    (!Number.isInteger(params.maxOutputTokens) || params.maxOutputTokens <= 0)
  ) {
    throw new Error("maxOutputTokens deve ser inteiro positivo");
  }

  return {
    requestId: params.requestId,
    tenantContext: params.tenantContext,
    actorContext: params.actorContext,
    profile: params.profile,
    prompt: params.prompt,
    system: params.system,
    temperature: params.temperature,
    maxOutputTokens: params.maxOutputTokens,
    metadata: params.metadata ?? {},
  };
}
