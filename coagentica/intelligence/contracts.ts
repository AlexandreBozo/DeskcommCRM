import type { TenantContext, ActorContext } from "@/coagentica/foundation/contracts/tenancy";
import type { PolicyDecision } from "@/coagentica/operations-core/contracts/policy";

export interface IntelligenceRequest<T = Record<string, unknown>> {
  readonly requestId: string;
  readonly tenantContext: TenantContext;
  readonly actorContext: ActorContext;
  readonly capability: string;
  readonly input: T;
  readonly policyDecision?: PolicyDecision;
  readonly metadata: Record<string, unknown>;
  readonly timestamp: string;
}

export interface ContextEnvelope {
  readonly tenantContext: TenantContext;
  readonly actorContext: ActorContext;
  readonly conversationId?: string;
  readonly leadId?: string;
  readonly contactId?: string;
  readonly additionalContext: Record<string, unknown>;
  readonly correlationId: string;
}

export interface CapabilityInvocation<TInput = Record<string, unknown>, TOutput = Record<string, unknown>> {
  readonly invocationId: string;
  readonly capability: string;
  readonly input: TInput;
  readonly output?: TOutput;
  readonly status: "pending" | "executing" | "completed" | "failed" | "cancelled";
  readonly startedAt: string;
  readonly completedAt?: string;
  readonly error?: string;
  readonly metadata: Record<string, unknown>;
  readonly actorContext: ActorContext;
}

export interface DecisionRecord {
  readonly decisionId: string;
  readonly tenantId: string;
  readonly actorId: string;
  readonly correlationId: string;
  readonly capability: string;
  readonly decision: "allow" | "deny" | "defer" | "escalate";
  readonly reason: string;
  readonly inputHash: string;
  readonly outputHash?: string;
  readonly policyDecision?: PolicyDecision;
  readonly timestamp: string;
  readonly metadata: Record<string, unknown>;
}

export function createIntelligenceRequest<T = Record<string, unknown>>(params: {
  requestId: string;
  tenantContext: TenantContext;
  actorContext: ActorContext;
  capability: string;
  input: T;
  policyDecision?: PolicyDecision;
  metadata?: Record<string, unknown>;
}): IntelligenceRequest<T> {
  if (!params.requestId || params.requestId.trim() === "") {
    throw new Error("requestId é obrigatório");
  }
  if (!params.capability || params.capability.trim() === "") {
    throw new Error("capability é obrigatório");
  }
  return {
    requestId: params.requestId,
    tenantContext: params.tenantContext,
    actorContext: params.actorContext,
    capability: params.capability,
    input: params.input,
    policyDecision: params.policyDecision,
    metadata: params.metadata ?? {},
    timestamp: new Date().toISOString(),
  };
}

export function createContextEnvelope(params: {
  tenantContext: TenantContext;
  actorContext: ActorContext;
  conversationId?: string;
  leadId?: string;
  contactId?: string;
  additionalContext?: Record<string, unknown>;
}): ContextEnvelope {
  return {
    tenantContext: params.tenantContext,
    actorContext: params.actorContext,
    conversationId: params.conversationId,
    leadId: params.leadId,
    contactId: params.contactId,
    additionalContext: params.additionalContext ?? {},
    correlationId: params.actorContext.correlationId ?? "",
  };
}

export function createCapabilityInvocation<TInput = Record<string, unknown>, TOutput = Record<string, unknown>>(params: {
  invocationId: string;
  capability: string;
  input: TInput;
  actorContext: ActorContext;
  metadata?: Record<string, unknown>;
}): CapabilityInvocation<TInput, TOutput> {
  if (!params.invocationId || params.invocationId.trim() === "") {
    throw new Error("invocationId é obrigatório");
  }
  if (!params.capability || params.capability.trim() === "") {
    throw new Error("capability é obrigatório");
  }
  return {
    invocationId: params.invocationId,
    capability: params.capability,
    input: params.input,
    status: "pending",
    startedAt: new Date().toISOString(),
    metadata: params.metadata ?? {},
    actorContext: params.actorContext,
  };
}

export function createDecisionRecord(params: {
  decisionId: string;
  tenantId: string;
  actorId: string;
  correlationId: string;
  capability: string;
  decision: "allow" | "deny" | "defer" | "escalate";
  reason: string;
  inputHash: string;
  outputHash?: string;
  policyDecision?: PolicyDecision;
  metadata?: Record<string, unknown>;
}): DecisionRecord {
  if (!params.decisionId || params.decisionId.trim() === "") {
    throw new Error("decisionId é obrigatório");
  }
  if (!params.tenantId || params.tenantId.trim() === "") {
    throw new Error("tenantId é obrigatório");
  }
  if (!params.actorId || params.actorId.trim() === "") {
    throw new Error("actorId é obrigatório");
  }
  if (!params.correlationId || params.correlationId.trim() === "") {
    throw new Error("correlationId é obrigatório");
  }
  if (!params.capability || params.capability.trim() === "") {
    throw new Error("capability é obrigatório");
  }
  if (!params.reason || params.reason.trim() === "") {
    throw new Error("reason é obrigatório");
  }
  if (!params.inputHash || params.inputHash.trim() === "") {
    throw new Error("inputHash é obrigatório");
  }
  return {
    decisionId: params.decisionId,
    tenantId: params.tenantId,
    actorId: params.actorId,
    correlationId: params.correlationId,
    capability: params.capability,
    decision: params.decision,
    reason: params.reason,
    inputHash: params.inputHash,
    outputHash: params.outputHash,
    policyDecision: params.policyDecision,
    timestamp: new Date().toISOString(),
    metadata: params.metadata ?? {},
  };
}

export function isDecisionTenantBound(record: DecisionRecord, tenantId: string): boolean {
  return record.tenantId === tenantId;
}

export function validateDecisionRecord(record: DecisionRecord): readonly string[] {
  const errors: string[] = [];
  if (!record.decisionId || record.decisionId.trim() === "") {
    errors.push("decisionId é obrigatório");
  }
  if (!record.tenantId || record.tenantId.trim() === "") {
    errors.push("tenantId é obrigatório");
  }
  if (!record.actorId || record.actorId.trim() === "") {
    errors.push("actorId é obrigatório");
  }
  if (!record.correlationId || record.correlationId.trim() === "") {
    errors.push("correlationId é obrigatório");
  }
  if (!record.capability || record.capability.trim() === "") {
    errors.push("capability é obrigatório");
  }
  if (!["allow", "deny", "defer", "escalate"].includes(record.decision)) {
    errors.push(`decision inválida: ${record.decision}`);
  }
  if (!record.reason || record.reason.trim() === "") {
    errors.push("reason é obrigatório");
  }
  if (!record.inputHash || record.inputHash.trim() === "") {
    errors.push("inputHash é obrigatório");
  }
  return errors;
}
