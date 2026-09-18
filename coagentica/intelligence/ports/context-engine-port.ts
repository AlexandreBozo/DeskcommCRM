import type { IntelligenceRequest } from "../contracts";
import type {
  ContextEngineStatus,
  ContextPreparationResult,
} from "../contracts/context-engine";
import type { TenantOperationalContextView } from "./tenant-operational-context-port";

export interface ContextEngineInput {
  readonly request: IntelligenceRequest;
  readonly context: TenantOperationalContextView | null;
}

export interface ContextEnginePort {
  prepare(input: ContextEngineInput): Promise<ContextPreparationResult>;
  status(): ContextEngineStatus;
}
