import type { DecisionRecord, IntelligenceRequest } from "../contracts";

export type LearningOutcome = "completed" | "blocked" | "deferred" | "escalated";

export interface LearningObservation {
  readonly observationId: string;
  readonly requestId: string;
  readonly tenantId: string;
  readonly actorId: string;
  readonly correlationId: string;
  readonly capability: string;
  readonly decision: DecisionRecord["decision"];
  readonly outcome: LearningOutcome;
  readonly inputHash: string;
  readonly outputHash?: string;
  readonly planId?: string;
  readonly stepId?: string;
  readonly planningStrategy?: string;
  readonly observedAt: string;
  readonly metadata: Record<string, unknown>;
}

function outcomeFor(decision: DecisionRecord["decision"]): LearningOutcome {
  if (decision === "allow") return "completed";
  if (decision === "deny") return "blocked";
  if (decision === "defer") return "deferred";
  return "escalated";
}

export function createLearningObservation(params: {
  request: IntelligenceRequest;
  decision: DecisionRecord;
  observedAt: string;
}): LearningObservation {
  const recordMetadata = params.decision.metadata;

  return {
    observationId: `${params.request.requestId}-learning`,
    requestId: params.request.requestId,
    tenantId: params.decision.tenantId,
    actorId: params.decision.actorId,
    correlationId: params.decision.correlationId,
    capability: params.decision.capability,
    decision: params.decision.decision,
    outcome: outcomeFor(params.decision.decision),
    inputHash: params.decision.inputHash,
    ...(params.decision.outputHash !== undefined && { outputHash: params.decision.outputHash }),
    ...(typeof recordMetadata.planId === "string" && { planId: recordMetadata.planId }),
    ...(typeof recordMetadata.stepId === "string" && { stepId: recordMetadata.stepId }),
    ...(typeof recordMetadata.planningStrategy === "string" && {
      planningStrategy: recordMetadata.planningStrategy,
    }),
    observedAt: params.observedAt,
    metadata: { version: "v0.11", mode: "observational" },
  };
}
