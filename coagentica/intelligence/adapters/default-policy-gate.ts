import type { Role } from "@/coagentica/foundation/contracts/tenancy";
import type {
  OperationalContextLimits,
  OperationalContextSelection,
} from "@/coagentica/intelligence/ports/tenant-operational-context-port";
import type {
  PolicyGatePort,
  PolicyGateResult,
} from "@/coagentica/intelligence/ports/policy-gate-port";

interface CapabilityPolicy {
  readonly minRole: Role;
  readonly selection?: OperationalContextSelection;
  readonly limits?: OperationalContextLimits;
}

const ROLE_RANK: Record<Role, number> = {
  viewer: 0,
  agent: 1,
  ai_operator: 2,
  manager: 3,
  admin: 4,
};

export const DEFAULT_NATIVE_CAPABILITY_POLICIES: Readonly<Record<string, CapabilityPolicy>> = {
  "system.runtime.info": { minRole: "viewer" },
  "tenant.context.summary": {
    minRole: "viewer",
    selection: {
      includeEntities: true,
      includeRelationships: true,
      includeKnowledgeSources: true,
      includeMemoryEntries: true,
      includeGoals: true,
      includeCapabilities: true,
    },
    limits: {
      maxEntities: 50,
      maxRelationships: 100,
      maxKnowledgeSources: 20,
      maxMemoryEntries: 20,
      maxGoals: 20,
      maxCapabilities: 100,
    },
  },
  "tenant.capabilities.list": {
    minRole: "viewer",
    selection: { includeCapabilities: true },
    limits: { maxCapabilities: 100 },
  },
};

export function createDefaultIntelligencePolicyGate(
  policies: Readonly<Record<string, CapabilityPolicy>> = DEFAULT_NATIVE_CAPABILITY_POLICIES
): PolicyGatePort {
  return {
    async authorize(request): Promise<PolicyGateResult> {
      const rule = policies[request.capability];
      if (!rule) {
        return {
          constraint: {
            decision: "deny",
            reason: `capability não autorizada pela policy: ${request.capability}`,
          },
        };
      }
      const role = request.tenantContext.role;
      const effectiveRank = request.tenantContext.isPlatformAdmin ? ROLE_RANK.admin : ROLE_RANK[role];
      if (effectiveRank < ROLE_RANK[rule.minRole]) {
        return {
          constraint: {
            decision: "deny",
            reason: `role insuficiente para ${request.capability}`,
            requiredRole: rule.minRole,
          },
        };
      }
      return {
        constraint: {
          decision: "allow",
          reason: `policy nativa permitiu ${request.capability}`,
          requiredRole: rule.minRole,
        },
        ...(rule.selection !== undefined ? { selection: rule.selection } : {}),
        ...(rule.limits !== undefined ? { limits: rule.limits } : {}),
      };
    },
  };
}
