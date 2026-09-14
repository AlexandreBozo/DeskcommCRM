import type { CapabilityInvocation } from "../contracts";
import type { CapabilityExecuteInput } from "./capability-executor-port";

/**
 * Handler nativo de uma única capability.
 *
 * A implementação concreta pode encapsular ferramenta, workflow ou outro executor,
 * mas este contrato não conhece providers, banco, tenant-runtime ou adapters.
 */
export interface NativeCapabilityHandler {
  readonly capability: string;
  execute(input: CapabilityExecuteInput): Promise<CapabilityInvocation>;
}
