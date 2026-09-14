import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";
import type { DecisionRecord } from "@/coagentica/intelligence/contracts";
import type { DecisionStorePort } from "@/coagentica/intelligence/ports/decision-store-port";

type AuditInsert = Database["public"]["Tables"]["api_audit_log"]["Insert"];

function decisionMetadata(record: DecisionRecord): AuditInsert["metadata"] {
  return {
    actor_id: record.actorId,
    correlation_id: record.correlationId,
    capability: record.capability,
    decision: record.decision,
    reason: record.reason,
    input_hash: record.inputHash,
    ...(record.outputHash !== undefined ? { output_hash: record.outputHash } : {}),
    ...(record.policyDecision !== undefined ? { policy_decision: record.policyDecision } : {}),
    record_metadata: record.metadata,
    decision_timestamp: record.timestamp,
  } as unknown as AuditInsert["metadata"];
}

export function createDeskcommDecisionStore(
  client: SupabaseClient<Database>
): DecisionStorePort {
  return {
    async saveDecision(record: DecisionRecord): Promise<DecisionRecord> {
      const insert: AuditInsert = {
        action: "coagentica.intelligence.decision",
        organization_id: record.tenantId,
        actor_user_id: record.actorId,
        resource_type: "coagentica_intelligence_decision",
        resource_id: record.decisionId,
        request_id: record.correlationId,
        metadata: decisionMetadata(record),
      };
      const { error } = await client.from("api_audit_log").insert(insert);
      if (error) throw new Error(`decision store falhou: ${error.message}`);
      return record;
    },
  };
}
