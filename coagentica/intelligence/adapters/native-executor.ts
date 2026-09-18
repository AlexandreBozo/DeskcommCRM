import type { CapabilityInvocation } from "../contracts";
import type { NativeActionDescriptor } from "../contracts/native-action";
import {
  createCapabilityRegistry,
} from "../capability-registry";
import type {
  CapabilityExecuteInput,
  CapabilityExecutorPort,
} from "../ports/capability-executor-port";
import type { NativeCapabilityHandler } from "../ports/capability-handler-port";

/**
 * Helper de composição. O runtime canônico não importa este adapter.
 */
export function createNativeExecutor(
  handlers: readonly NativeCapabilityHandler[]
): CapabilityExecutorPort {
  return createCapabilityRegistry(handlers);
}

/**
 * Define um handler nativo sem acoplar módulos ao registry.
 *
 * Convenção v0.6: handlers não devem incluir PII/secrets em mensagens de erro.
 */
export function defineNativeCapability(
  capability: string,
  execute: (
    input: CapabilityExecuteInput
  ) => Promise<CapabilityInvocation>,
  action?: NativeActionDescriptor
): NativeCapabilityHandler {
  const normalized = capability.trim();
  if (!normalized) {
    throw new Error("capability é obrigatória");
  }
  return {
    capability: normalized,
    ...(action ? { action } : {}),
    execute,
  };
}
