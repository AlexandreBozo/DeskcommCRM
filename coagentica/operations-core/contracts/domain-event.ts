import type { TenantContext } from "@/coagentica/foundation/contracts/tenancy";

/**
 * Registro canônico de evento de origem — equivalente estrutural ao EventRow
 * do Deskcomm (`lib/event-log/dispatcher`), mas sem dependência de runtime.
 *
 * Este tipo existe para que operations-core/contracts não importe `@/lib`.
 * A adaptação do formato legado EventRow para este tipo vive em
 * `operations-core/adapters/domain-event-adapter.ts`.
 */
export interface SourceEventRecord {
  readonly id: string;
  readonly organization_id: string;
  readonly event_type: string;
  readonly entity_kind: string;
  readonly entity_id: string | null;
  readonly payload: Record<string, unknown>;
  readonly metadata: Record<string, unknown>;
  readonly consumed_by: readonly string[];
  readonly attempts: number;
  readonly created_at?: string;
}

export interface DomainEvent<T = Record<string, unknown>> {
  readonly eventType: string;
  readonly entityKind: string;
  readonly entityId: string | null;
  readonly payload: T;
  readonly metadata: Record<string, unknown>;
  readonly occurredAt: string;
  readonly correlationId: string;
  readonly causationId?: string;
}

export interface EventEnvelope<T = Record<string, unknown>> {
  readonly event: DomainEvent<T>;
  readonly tenantContext: TenantContext;
  readonly envelopeId: string;
  readonly receivedAt: string;
}

export function toEventEnvelope<T = Record<string, unknown>>(
  event: DomainEvent<T>,
  tenantContext: TenantContext,
  envelopeId?: string
): EventEnvelope<T> {
  return {
    event,
    tenantContext,
    envelopeId: envelopeId ?? crypto.randomUUID(),
    receivedAt: new Date().toISOString(),
  };
}

export function createDomainEvent<T = Record<string, unknown>>(params: {
  eventType: string;
  entityKind: string;
  entityId?: string | null;
  payload?: T;
  metadata?: Record<string, unknown>;
  occurredAt?: string;
  correlationId?: string;
  causationId?: string;
}): DomainEvent<T> {
  if (!params.eventType || params.eventType.trim() === "") {
    throw new Error("eventType é obrigatório");
  }
  return {
    eventType: params.eventType,
    entityKind: params.entityKind,
    entityId: params.entityId ?? null,
    payload: params.payload ?? ({} as T),
    metadata: params.metadata ? { ...params.metadata } : {},
    occurredAt: params.occurredAt ?? new Date().toISOString(),
    correlationId: params.correlationId ?? "",
    causationId: params.causationId,
  };
}

export function createEventEnvelope<T = Record<string, unknown>>(
  event: DomainEvent<T>,
  tenantContext: TenantContext
): EventEnvelope<T> {
  return {
    event,
    tenantContext,
    envelopeId: crypto.randomUUID(),
    receivedAt: new Date().toISOString(),
  };
}

export function domainEventFromRecord<T = Record<string, unknown>>(
  row: SourceEventRecord,
  correlationId: string,
  causationId?: string
): DomainEvent<T> {
  return {
    eventType: row.event_type,
    entityKind: row.entity_kind,
    entityId: row.entity_id,
    payload: row.payload as T,
    metadata: row.metadata,
    occurredAt: row.created_at ?? new Date().toISOString(),
    correlationId,
    causationId,
  };
}

export function extractCorrelationId(row: SourceEventRecord): string {
  const fromMetadata = row.metadata.correlationId;
  if (typeof fromMetadata === "string" && fromMetadata.trim() !== "") {
    return fromMetadata;
  }
  const fromPayload = row.payload.correlationId;
  if (typeof fromPayload === "string" && fromPayload.trim() !== "") {
    return fromPayload;
  }
  return row.id;
}

export function extractCausationId(row: SourceEventRecord): string | undefined {
  const fromMetadata = row.metadata.causationId;
  if (typeof fromMetadata === "string" && fromMetadata.trim() !== "") {
    return fromMetadata;
  }
  const fromPayload = row.payload.causationId;
  if (typeof fromPayload === "string" && fromPayload.trim() !== "") {
    return fromPayload;
  }
  return undefined;
}

export function eventRecordToEnvelope<T = Record<string, unknown>>(
  row: SourceEventRecord,
  tenantContext: TenantContext
): EventEnvelope<T> {
  const correlationId = extractCorrelationId(row);
  const causationId = extractCausationId(row);
  const event = domainEventFromRecord<T>(row, correlationId, causationId);
  return toEventEnvelope(event, tenantContext);
}
