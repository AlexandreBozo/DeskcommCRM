import type { IntelligenceRequest } from "../contracts";
import type { GovernanceAssessment } from "../contracts/governance";
import type { ExecutionPlanStep } from "../contracts/planning";
import type { TenantOperationalContextView } from "./tenant-operational-context-port";

export interface GovernanceInput {
  readonly request: IntelligenceRequest;
  readonly step: ExecutionPlanStep;
  readonly context: TenantOperationalContextView | null;
}

export interface GovernancePort {
  assess(input: GovernanceInput): Promise<GovernanceAssessment>;
  status(): {
    readonly version: "v0.19";
    readonly mode: "human-in-the-loop";
  };
}
