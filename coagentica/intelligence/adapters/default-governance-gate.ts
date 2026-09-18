import { readHumanApproval } from "../contracts/governance";
import {
  READ_ONLY_ACTION,
  type NativeActionDescriptor,
} from "../contracts/native-action";
import type { GovernancePort } from "../ports/governance-port";
import type { NativeCapabilityHandler } from "../ports/capability-handler-port";

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

export function createDefaultGovernanceGate(
  handlers: readonly NativeCapabilityHandler[]
): GovernancePort {
  const actions = new Map<string, NativeActionDescriptor>(
    handlers.map((handler) => [handler.capability, handler.action ?? READ_ONLY_ACTION])
  );

  return {
    status() {
      return { version: "v0.19", mode: "human-in-the-loop" };
    },

    async assess({ request, step }) {
      const action = actions.get(step.capability);
      if (!action) {
        return {
          decision: "deny",
          reason: "capability sem descriptor governado",
          version: "v0.19",
          action: READ_ONLY_ACTION,
        };
      }

      if (action.idempotency === "required" && !nonEmpty(request.metadata.idempotencyKey)) {
        return {
          decision: "deny",
          reason: "ação mutável exige idempotencyKey",
          version: "v0.19",
          action,
        };
      }

      if (!action.requiresApproval) {
        return {
          decision: "allow",
          reason: "ação permitida pela classificação de side effect",
          version: "v0.19",
          action: action,
        };
      }

      const approval = readHumanApproval(request.metadata.approval);
      if (
        !approval ||
        approval.requestId !== request.requestId ||
        approval.tenantId !== request.tenantContext.tenantId ||
        approval.capability !== step.capability
      ) {
        return {
          decision: "approval_required",
          reason: "ação sensível exige aprovação humana vinculada ao request",
          version: "v0.19",
          action,
        };
      }

      return {
        decision: "allow",
        reason: "aprovação humana válida",
        version: "v0.19",
        action,
        approvalId: approval.approvalId,
      };
    },
  };
}
