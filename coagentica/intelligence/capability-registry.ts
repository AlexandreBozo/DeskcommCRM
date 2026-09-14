import type { CapabilityInvocation } from "./contracts";
import type {
  CapabilityExecuteInput,
  CapabilityExecutorPort,
} from "./ports/capability-executor-port";
import type { NativeCapabilityHandler } from "./ports/capability-handler-port";

export class InvalidCapabilityRegistrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidCapabilityRegistrationError";
  }
}

export class DuplicateCapabilityError extends Error {
  readonly capability: string;

  constructor(capability: string) {
    super(`capability duplicada: ${capability}`);
    this.name = "DuplicateCapabilityError";
    this.capability = capability;
  }
}

export class UnknownCapabilityError extends Error {
  readonly capability: string;

  constructor(capability: string) {
    super(`capability desconhecida: ${capability}`);
    this.name = "UnknownCapabilityError";
    this.capability = capability;
  }
}

export class CapabilityUnavailableError extends Error {
  readonly capability: string;
  readonly tenantId: string;

  constructor(capability: string, tenantId: string, status: string) {
    super(`capability indisponível no tenant: ${capability} (${status})`);
    this.name = "CapabilityUnavailableError";
    this.capability = capability;
    this.tenantId = tenantId;
  }
}

export class CapabilityContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CapabilityContractError";
  }
}

function normalizeCapability(value: string): string {
  const capability = value.trim();
  if (capability === "") {
    throw new InvalidCapabilityRegistrationError("capability é obrigatória");
  }
  return capability;
}

function assertExecutionBoundary(input: CapabilityExecuteInput): string {
  const requested = normalizeCapability(input.request.capability);
  const invocationCapability = normalizeCapability(input.invocation.capability);

  if (requested !== invocationCapability) {
    throw new CapabilityContractError(
      "request.capability diverge de invocation.capability"
    );
  }

  if (input.context !== null) {
    const tenantId = input.request.tenantContext.tenantId;
    const organizationId = input.request.tenantContext.organizationId;
    if (
      input.context.tenantId !== tenantId ||
      input.context.organizationId !== organizationId ||
      tenantId !== organizationId
    ) {
      throw new CapabilityContractError(
        "contexto do executor pertence a outro tenant"
      );
    }
  }

  return requested;
}

function assertTenantAvailability(
  input: CapabilityExecuteInput,
  capability: string
): void {
  if (input.context === null || input.context.capabilities.length === 0) {
    return;
  }

  const projected = input.context.capabilities.find(
    (item) =>
      item.capabilityId === capability ||
      item.name === capability
  );

  if (projected && projected.status !== "available") {
    throw new CapabilityUnavailableError(
      capability,
      input.request.tenantContext.tenantId,
      projected.status
    );
  }
}

/**
 * Registry puro de capabilities nativas.
 *
 * - exact-match e case-sensitive;
 * - duplicata falha na composição;
 * - capability desconhecida falha fechada no request;
 * - não possui fallback implícito;
 * - não importa adapters, providers, banco ou runtime de tenant.
 */
export function createCapabilityRegistry(
  handlers: readonly NativeCapabilityHandler[]
): CapabilityExecutorPort {
  const registry = new Map<string, NativeCapabilityHandler>();

  for (const handler of handlers) {
    const capability = normalizeCapability(handler.capability);
    if (registry.has(capability)) {
      throw new DuplicateCapabilityError(capability);
    }
    registry.set(capability, {
      capability,
      execute: handler.execute,
    });
  }

  return {
    async execute(input: CapabilityExecuteInput): Promise<CapabilityInvocation> {
      const capability = assertExecutionBoundary(input);
      const handler = registry.get(capability);
      if (!handler) {
        throw new UnknownCapabilityError(capability);
      }

      assertTenantAvailability(input, capability);
      const result = await handler.execute(input);

      if (result.capability !== capability) {
        throw new CapabilityContractError(
          "handler retornou capability diferente da registrada"
        );
      }
      if (result.invocationId !== input.invocation.invocationId) {
        throw new CapabilityContractError(
          "handler alterou invocationId canônico"
        );
      }

      return result;
    },
  };
}
