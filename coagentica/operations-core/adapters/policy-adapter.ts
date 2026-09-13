import type { ActorContext } from "@/coagentica/foundation/contracts/tenancy";
import type { PolicyDecision } from "../contracts/policy";

export function adaptActorContextToPolicyDecision(
  actorContext: ActorContext,
  decision: "allow" | "deny" | "defer",
  reason: string
): PolicyDecision {
  const tenantId = actorContext.tenantContext?.tenantId ?? actorContext.tenantId ?? "";
  const correlationId = actorContext.correlationId ?? "";
  return {
    decision,
    reason,
    tenantId,
    actorId: actorContext.actorId,
    correlationId,
  };
}
