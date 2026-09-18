import type { CapabilityInvocation } from "@/coagentica/intelligence/contracts";
import type { CapabilityExecuteInput } from "@/coagentica/intelligence/ports/capability-executor-port";
import type { NativeCapabilityHandler } from "@/coagentica/intelligence/ports/capability-handler-port";
import type { ModelGatewayPort } from "@/coagentica/intelligence/ports/model-gateway-port";
import type { AgentRuntimeStatus } from "@/coagentica/intelligence/contracts/agent-runtime";
import type { MemoryRuntimeStatus } from "@/coagentica/intelligence/contracts/memory";
import type { ContextEngineStatus } from "@/coagentica/intelligence/contracts/context-engine";

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
  memoryStatus: MemoryRuntimeStatus = {
    version: "v0.12",
    mode: "read-only",
    writesEnabled: false,
    budget: { maxEntries: 20 },
  },
  contextEngineStatus: ContextEngineStatus = {
    version: "v0.15",
    mode: "bounded-relevance",
    budget: {
      maxEntities: 20,
      maxRelationships: 30,
      maxKnowledgeSources: 8,
      maxMemoryEntries: 12,
      maxGoals: 5,
      maxCapabilities: 20,
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
        runtimeRelease: "v1.0",
        foundation: "v1.0",
        tenantOperationsCore: "v0.3",
        operationalContextBridge: "v0.4",
        intelligenceRuntime: "v0.5",
        capabilityRegistry: "v0.6",
        goals: { version: "v0.13", mode: "read-only" },
        planning: {
          goalAware: "v0.14",
          multiStep: "v0.16",
          maxSteps: agentRuntimeStatus.budget.maxPlanSteps,
        },
        contextEngine: contextEngineStatus,
        agentRuntime: agentRuntimeStatus,
        nativeActions: { version: "v0.18", mutationsEnabled: false },
        governance: { version: "v0.19", mode: "human-in-the-loop" },
        channels: { version: "v0.20", normalizedInput: true },
        learning: "v0.11",
        memory: memoryStatus,
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

const goalsList: NativeCapabilityHandler = {
  capability: "tenant.goals.list",
  async execute(input) {
    if (input.context === null) {
      throw new Error("tenant.goals.list requer contexto operacional autorizado");
    }
    return completed(input, {
      tenantId: input.context.tenantId,
      goals: input.context.goals.map((goal) => ({
        goalId: goal.goalId,
        name: goal.name,
        description: goal.description,
        status: goal.status,
      })),
      truncated: input.context.truncated.goals,
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
  readonly memoryStatus?: MemoryRuntimeStatus;
  readonly contextEngineStatus?: ContextEngineStatus;
}

export function createSystemNativeCapabilities(
  options: SystemNativeCapabilitiesOptions = {},
): readonly NativeCapabilityHandler[] {
  return [
    createRuntimeInfo(
      options.modelGateway,
      options.agentRuntimeStatus,
      options.memoryStatus,
      options.contextEngineStatus,
    ),
    contextSummary,
    goalsList,
    capabilityList,
  ];
}
