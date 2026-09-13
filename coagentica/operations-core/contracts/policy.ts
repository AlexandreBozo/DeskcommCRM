import type { ActorContext } from "@/coagentica/foundation/contracts/tenancy";

export interface PolicyDecision<T = Record<string, unknown>> {
  readonly decision: "allow" | "deny" | "defer";
  readonly reason: string;
  readonly tenantId: string;
  readonly actorId: string;
  readonly correlationId: string;
  readonly requiredRole?: string;
  readonly retryAt?: string;
  readonly metadata?: T;
}

export function allow<T = Record<string, unknown>>(params: {
  reason: string;
  tenantId: string;
  actorId: string;
  correlationId: string;
  metadata?: T;
}): PolicyDecision<T> {
  return {
    decision: "allow",
    reason: params.reason,
    tenantId: params.tenantId,
    actorId: params.actorId,
    correlationId: params.correlationId,
    metadata: params.metadata,
  };
}

export function deny<T = Record<string, unknown>>(params: {
  reason: string;
  tenantId: string;
  actorId: string;
  correlationId: string;
  requiredRole?: string;
  metadata?: T;
}): PolicyDecision<T> {
  return {
    decision: "deny",
    reason: params.reason,
    tenantId: params.tenantId,
    actorId: params.actorId,
    correlationId: params.correlationId,
    requiredRole: params.requiredRole,
    metadata: params.metadata,
  };
}

export function defer<T = Record<string, unknown>>(params: {
  reason: string;
  tenantId: string;
  actorId: string;
  correlationId: string;
  retryAt: string;
  metadata?: T;
}): PolicyDecision<T> {
  if (!params.retryAt || params.retryAt.trim() === "") {
    throw new Error("retryAt é obrigatório para decisão defer");
  }
  const retryDate = new Date(params.retryAt);
  if (isNaN(retryDate.getTime())) {
    throw new Error("retryAt deve ser uma data ISO-8601 válida");
  }
  return {
    decision: "defer",
    reason: params.reason,
    tenantId: params.tenantId,
    actorId: params.actorId,
    correlationId: params.correlationId,
    retryAt: params.retryAt,
    metadata: params.metadata,
  };
}

export function isAllowed<T>(decision: PolicyDecision<T>): boolean {
  return decision.decision === "allow";
}

export function isDenied<T>(decision: PolicyDecision<T>): boolean {
  return decision.decision === "deny";
}

export function isDeferred<T>(decision: PolicyDecision<T>): boolean {
  return decision.decision === "defer";
}

export function validatePolicyDecision<T>(decision: PolicyDecision<T>): readonly string[] {
  const errors: string[] = [];
  if (!decision.tenantId || decision.tenantId.trim() === "") {
    errors.push("tenantId é obrigatório");
  }
  if (!decision.actorId || decision.actorId.trim() === "") {
    errors.push("actorId é obrigatório");
  }
  if (!decision.correlationId || decision.correlationId.trim() === "") {
    errors.push("correlationId é obrigatório");
  }
  if (!decision.reason || decision.reason.trim() === "") {
    errors.push("reason é obrigatório");
  }
  if (decision.decision === "defer") {
    if (!decision.retryAt || decision.retryAt.trim() === "") {
      errors.push("retryAt é obrigatório para decisão defer");
    } else {
      const retryDate = new Date(decision.retryAt);
      if (isNaN(retryDate.getTime())) {
        errors.push("retryAt deve ser uma data ISO-8601 válida");
      }
    }
  }
  return errors;
}

export function policyDecisionFromActorContext<T = Record<string, unknown>>(
  actorContext: ActorContext,
  decision: "allow" | "deny" | "defer",
  reason: string,
  options?: {
    requiredRole?: string;
    retryAt?: string;
    metadata?: T;
  }
): PolicyDecision<T> {
  const base = {
    tenantId: actorContext.tenantContext?.tenantId ?? actorContext.tenantId ?? "",
    actorId: actorContext.actorId,
    correlationId: actorContext.correlationId ?? "",
    ...options,
  };

  switch (decision) {
    case "allow":
      return allow({ ...base, reason });
    case "deny":
      return deny({ ...base, reason, requiredRole: options?.requiredRole });
    case "defer":
      if (!options?.retryAt) {
        throw new Error("retryAt é obrigatório para decisão defer");
      }
      return defer({ ...base, reason, retryAt: options.retryAt });
  }
}
