import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";
import type { LearningObservation } from "@/coagentica/intelligence/contracts/learning";
import type { LearningPort } from "@/coagentica/intelligence/ports/learning-port";

type AuditInsert = Database["public"]["Tables"]["api_audit_log"]["Insert"];

function learningMetadata(observation: LearningObservation): AuditInsert["metadata"] {
  return {
    observation_id: observation.observationId,
    request_id: observation.requestId,
    capability: observation.capability,
    decision: observation.decision,
    outcome: observation.outcome,
    input_hash: observation.inputHash,
    ...(observation.outputHash !== undefined ? { output_hash: observation.outputHash } : {}),
    ...(observation.planId !== undefined ? { plan_id: observation.planId } : {}),
    ...(observation.stepId !== undefined ? { step_id: observation.stepId } : {}),
    ...(observation.planningStrategy !== undefined
      ? { planning_strategy: observation.planningStrategy }
      : {}),
    observed_at: observation.observedAt,
    metadata: observation.metadata,
  } as unknown as AuditInsert["metadata"];
}

export function createDeskcommLearningObserver(
  client: SupabaseClient<Database>
): LearningPort {
  return {
    async observe(observation) {
      const insert: AuditInsert = {
        action: "coagentica.intelligence.learning",
        organization_id: observation.tenantId,
        actor_user_id: observation.actorId,
        resource_type: "coagentica_intelligence_learning",
        resource_id: null,
        request_id: observation.correlationId,
        metadata: learningMetadata(observation),
      };

      const { error } = await client.from("api_audit_log").insert(insert);
      if (error) throw new Error(`learning observer falhou: ${error.message}`);
    },
  };
}
