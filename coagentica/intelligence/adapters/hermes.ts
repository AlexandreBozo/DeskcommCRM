import type { IntelligenceRequest, ContextEnvelope, CapabilityInvocation, DecisionRecord } from "../contracts";
import type { OrchestratorPort } from "../orchestrator-port";
import { createOrchestratorPort } from "../orchestrator-port";

/**
 * Hermes adapter — optional/compatibility layer.
 *
 * Hermes is NOT a required dependency of the intelligence core.
 * This adapter provides a bridge for environments that already
 * have Hermes integrated. All core contracts work independently
 * of Hermes.
 */

export interface HermesAdapterConfig {
  readonly endpoint?: string;
  readonly timeout?: number;
  readonly apiKey?: string;
}

export interface HermesAdapter {
  readonly config: HermesAdapterConfig;
  readonly available: boolean;
  submitIntelligence(request: IntelligenceRequest): Promise<CapabilityInvocation>;
  submitContext(context: ContextEnvelope): Promise<DecisionRecord>;
  submitInvocation(invocation: CapabilityInvocation): Promise<CapabilityInvocation>;
  submitDecision(decision: DecisionRecord): Promise<DecisionRecord>;
}

export function createHermesAdapter(config: HermesAdapterConfig): HermesAdapter {
  const available = config.endpoint !== undefined && config.endpoint.trim() !== "";
  return {
    config,
    available,
    async submitIntelligence(request: IntelligenceRequest): Promise<CapabilityInvocation> {
      if (!available) {
        throw new Error("Hermes adapter not configured: endpoint is required");
      }
      return {
        invocationId: `${request.requestId}-inv`,
        capability: request.capability,
        input: request.input as Record<string, unknown>,
        status: "pending",
        startedAt: new Date().toISOString(),
        metadata: request.metadata,
        actorContext: request.actorContext,
      };
    },
    async submitContext(context: ContextEnvelope): Promise<DecisionRecord> {
      if (!available) {
        throw new Error("Hermes adapter not configured: endpoint is required");
      }
      return {
        decisionId: `${context.correlationId}-dec`,
        tenantId: context.tenantContext.tenantId,
        actorId: context.actorContext.actorId,
        correlationId: context.correlationId,
        capability: "context_analysis",
        decision: "allow",
        reason: "Hermes context processed",
        inputHash: "",
        timestamp: new Date().toISOString(),
        metadata: context.additionalContext,
      };
    },
    async submitInvocation(invocation: CapabilityInvocation): Promise<CapabilityInvocation> {
      if (!available) {
        throw new Error("Hermes adapter not configured: endpoint is required");
      }
      return { ...invocation, status: "executing" };
    },
    async submitDecision(decision: DecisionRecord): Promise<DecisionRecord> {
      if (!available) {
        throw new Error("Hermes adapter not configured: endpoint is required");
      }
      return { ...decision, timestamp: new Date().toISOString() };
    },
  };
}

export function isHermesAvailable(adapter: HermesAdapter): boolean {
  return adapter.available;
}

export function requireHermesAdapter(adapter: HermesAdapter): HermesAdapter {
  if (!adapter.available) {
    throw new Error("Hermes adapter is not configured. Provide a valid endpoint to use Hermes integration.");
  }
  return adapter;
}

export function toOrchestratorPort(adapter: HermesAdapter): OrchestratorPort | null {
  if (!adapter.available) {
    return null;
  }
  const request: IntelligenceRequest = {
    requestId: `hermes-${Date.now()}`,
    tenantContext: {
      tenantId: "",
      organizationId: "",
      organizationName: "",
      role: "agent",
      visibilityMode: "own",
      locale: "",
      timezone: "UTC",
      isPlatformAdmin: false,
    },
    actorContext: {
      actorId: "hermes",
      actorType: "agent",
      tenantContext: {
        tenantId: "",
        organizationId: "",
        organizationName: "",
        role: "agent",
        visibilityMode: "own",
        locale: "",
        timezone: "UTC",
        isPlatformAdmin: false,
      },
    },
    capability: "hermes_orchestration",
    input: {},
    metadata: {},
    timestamp: new Date().toISOString(),
  };
  const context: ContextEnvelope = {
    tenantContext: request.tenantContext,
    actorContext: request.actorContext,
    additionalContext: {},
    correlationId: "",
  };
  const invocation: CapabilityInvocation = {
    invocationId: `hermes-${Date.now()}`,
    capability: "hermes",
    input: {},
    status: "pending",
    startedAt: new Date().toISOString(),
    metadata: {},
    actorContext: request.actorContext,
  };
  const decision: DecisionRecord = {
    decisionId: `hermes-${Date.now()}`,
    tenantId: "",
    actorId: "hermes",
    correlationId: "",
    capability: "hermes",
    decision: "allow",
    reason: "Hermes orchestrator port",
    inputHash: "",
    timestamp: new Date().toISOString(),
    metadata: {},
  };
  return createOrchestratorPort({ request, context, invocation, decision });
}
