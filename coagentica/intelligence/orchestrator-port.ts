import type { IntelligenceRequest, ContextEnvelope, CapabilityInvocation, DecisionRecord } from "./contracts";

export interface OrchestratorPort {
  readonly request: IntelligenceRequest;
  readonly context: ContextEnvelope;
  readonly invocation: CapabilityInvocation;
  readonly decision: DecisionRecord;
}

export interface OrchestratorCapabilities {
  classify: (input: Record<string, unknown>, context: ContextEnvelope) => Promise<Record<string, unknown>>;
  route: (capability: string, context: ContextEnvelope) => Promise<string>;
  execute: (invocation: CapabilityInvocation) => Promise<CapabilityInvocation>;
  decide: (request: IntelligenceRequest, context: ContextEnvelope) => Promise<DecisionRecord>;
}

export function createOrchestratorPort(params: {
  request: IntelligenceRequest;
  context: ContextEnvelope;
  invocation: CapabilityInvocation;
  decision: DecisionRecord;
}): OrchestratorPort {
  return {
    request: params.request,
    context: params.context,
    invocation: params.invocation,
    decision: params.decision,
  };
}

export function validateOrchestratorPort(port: OrchestratorPort): readonly string[] {
  const errors: string[] = [];
  if (!port.request.requestId || port.request.requestId.trim() === "") {
    errors.push("request.requestId é obrigatório");
  }
  if (!port.context.correlationId || port.context.correlationId.trim() === "") {
    errors.push("context.correlationId é obrigatório");
  }
  if (!port.invocation.invocationId || port.invocation.invocationId.trim() === "") {
    errors.push("invocation.invocationId é obrigatório");
  }
  if (!port.decision.decisionId || port.decision.decisionId.trim() === "") {
    errors.push("decision.decisionId é obrigatório");
  }
  return errors;
}
