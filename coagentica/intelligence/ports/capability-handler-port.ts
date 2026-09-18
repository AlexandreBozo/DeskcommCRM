import type { CapabilityInvocation } from "../contracts";
import type { NativeActionDescriptor } from "../contracts/native-action";
import type { CapabilityExecuteInput } from "./capability-executor-port";

/**
 * Handler nativo de uma única capability.
 *
 * A implementação concreta pode encapsular ferramenta, workflow ou outro executor,
 * mas este contrato não conhece providers, banco, tenant-runtime ou adapters.
 */
export interface NativeCapabilityHandler {
  readonly capability: string;
  readonly action?: NativeActionDescriptor;
  execute(input: CapabilityExecuteInput): Promise<CapabilityInvocation>;
}
