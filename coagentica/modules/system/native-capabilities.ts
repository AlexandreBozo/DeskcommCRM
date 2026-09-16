import type { CapabilityInvocation } from "@/coagentica/intelligence/contracts";
import type { CapabilityExecuteInput } from "@/coagentica/intelligence/ports/capability-executor-port";
import type { NativeCapabilityHandler } from "@/coagentica/intelligence/ports/capability-handler-port";
import type { ModelGatewayPort } from "@/coagentica/intelligence/ports/model-gateway-port";
import type { AgentRuntimeStatus } from "@/coagentica/intelligence/contracts/agent-runtime";

function completed(
  input: CapabilityExecuteInput,
  output: Record<string, unknown>
): CapabilityInvocation {
  return {
    ...input.invocation,
    status: "completed",
    completedAt: input.request.timestamp,
    output,
  };
}

function createRuntimeInfo(
  modelGateway?: ModelGatewayPort,
  agentRuntimeStatus: AgentRuntimeStatus = {
    version: "v0.10",
    mode: "bounded",
    budget: {
      maxPlanSteps: 1,
      maxCapabilityInvocations: 1,
      maxModelCalls: 0,
      autonomous: false,
    },
  },
): NativeCapabilityHandler {
  return {
    capability: "system.runtime.info",
    async execute(input) {
      const gatewayStatus = modelGateway
        ? await modelGateway.status()
        : { available: false, profiles: [] as const };
      return completed(input, {
        architecture: "coagentica",
        foundation: "v0.1",
        tenantOperationsCore: "v0.3",
        operationalContextBridge: "v0.4",
        intelligenceRuntime: "v0.5",
        capabilityRegistry: "v0.6",
        planning: "v0.9",
        agentRuntime: agentRuntimeStatus,
        modelGateway: {
          version: "v0.8",
          available: gatewayStatus.available,
          profiles: gatewayStatus.profiles,
        },
        tenantId: input.request.tenantContext.tenantId,
        contextLoaded: input.context !== null,
      });
    },
  };
}

const contextSummary: NativeCapabilityHandler = {
  capability: "tenant.context.summary",
  async execute(input) {
    if (input.context === null) {
      throw new Error("tenant.context.summary requer contexto operacional autorizado");
    }
    return completed(input, {
      tenantId: input.context.tenantId,
      organizationId: input.context.organizationId,
      sourceVersion: input.context.sourceVersion,
      snapshotAt: input.context.snapshotAt,
      counts: {
        entities: input.context.entities.length,
        relationships: input.context.relationships.length,
        knowledgeSources: input.context.knowledgeSources.length,
        memoryEntries: input.context.memoryEntries.length,
        goals: input.context.goals.length,
        capabilities: input.context.capabilities.length,
      },
      truncated: input.context.truncated,
    });
  },
};

const capabilityList: NativeCapabilityHandler = {
  capability: "tenant.capabilities.list",
  async execute(input) {
    if (input.context === null) {
      throw new Error("tenant.capabilities.list requer contexto operacional autorizado");
    }
    return completed(input, {
      tenantId: input.context.tenantId,
      capabilities: input.context.capabilities.map((item) => ({
        capabilityId: item.capabilityId,
        name: item.name,
        type: item.type,
        status: item.status,
      })),
      truncated: input.context.truncated.capabilities,
    });
  },
};

export interface SystemNativeCapabilitiesOptions {
  readonly modelGateway?: ModelGatewayPort;
  readonly agentRuntimeStatus?: AgentRuntimeStatus;
}

export function createSystemNativeCapabilities(
  options: SystemNativeCapabilitiesOptions = {},
): readonly NativeCapabilityHandler[] {
  return [
    createRuntimeInfo(options.modelGateway, options.agentRuntimeStatus),
    contextSummary,
    capabilityList,
  ];
}
