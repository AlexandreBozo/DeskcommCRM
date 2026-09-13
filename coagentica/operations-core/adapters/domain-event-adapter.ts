import type { EventRow } from "@/lib/event-log/dispatcher";
import type { TenantContext } from "@/coagentica/foundation/contracts/tenancy";
import type { DomainEvent, EventEnvelope, SourceEventRecord } from "../contracts/domain-event";
import { domainEventFromRecord, extractCorrelationId, extractCausationId, toEventEnvelope } from "../contracts/domain-event";
export type { DomainEvent, EventEnvelope, SourceEventRecord } from "../contracts/domain-event";

/**
 * Converte EventRow (formato legado do Deskcomm) para SourceEventRecord
 * (tipo canônico do operations-core).
 */
export function adaptEventRowToRecord(row: EventRow): SourceEventRecord {
  return {
    id: row.id,
    organization_id: row.organization_id,
    event_type: row.event_type,
    entity_kind: row.entity_kind,
    entity_id: row.entity_id,
    payload: row.payload,
    metadata: row.metadata,
    consumed_by: row.consumed_by,
    attempts: row.attempts,
    created_at: row.created_at,
  };
}

/**
 * Converte EventRow (formato legado) para DomainEvent.
 * Alias de compatibilidade — delega para domainEventFromRecord via adaptEventRowToRecord.
 */
export function adaptEventRowToDomainEvent(row: EventRow): DomainEvent {
  const record = adaptEventRowToRecord(row);
  const correlationId = extractCorrelationId(record);
  const causationId = extractCausationId(record);
  return domainEventFromRecord(record, correlationId, causationId);
}

export function adaptDomainEventToEnvelope(
  event: DomainEvent,
  tenantContext: TenantContext
): EventEnvelope {
  return toEventEnvelope(event, tenantContext);
}
