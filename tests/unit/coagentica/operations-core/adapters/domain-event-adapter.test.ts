import { describe, it, expect } from "vitest";
import {
  adaptEventRowToDomainEvent,
  adaptEventRowToRecord,
  adaptDomainEventToEnvelope,
  type DomainEvent,
} from "@/coagentica/operations-core/adapters/domain-event-adapter";
import type { EventRow } from "@/lib/event-log/dispatcher";
import type { TenantContext } from "@/coagentica/foundation/contracts/tenancy";

const mockTenantContext: TenantContext = {
  tenantId: "tenant-123",
  organizationId: "org-456",
  organizationName: "Test Org",
  role: "agent",
  visibilityMode: "own_and_unassigned",
  locale: "pt-BR",
  timezone: "America/Sao_Paulo",
  isPlatformAdmin: false,
};

const baseEventRow: EventRow = {
  id: "evt-001",
  organization_id: "org-456",
  event_type: "lead.created",
  entity_kind: "lead",
  entity_id: "lead-789",
  payload: { name: "John Doe", value: 100 },
  metadata: { source: "webhook" },
  consumed_by: [],
  attempts: 0,
  created_at: "2026-01-15T10:30:00Z",
};

describe("coagentica/operations-core/adapters/domain-event-adapter", () => {
  describe("adaptEventRowToRecord", () => {
    it("converte EventRow para SourceEventRecord", () => {
      const record = adaptEventRowToRecord(baseEventRow);
      expect(record.id).toBe("evt-001");
      expect(record.event_type).toBe("lead.created");
      expect(record.entity_kind).toBe("lead");
      expect(record.entity_id).toBe("lead-789");
    });
  });

  describe("adaptEventRowToDomainEvent", () => {
    it("converte EventRow para DomainEvent", () => {
      const event = adaptEventRowToDomainEvent(baseEventRow);
      expect(event.eventType).toBe("lead.created");
      expect(event.entityKind).toBe("lead");
      expect(event.entityId).toBe("lead-789");
    });
  });

  describe("adaptDomainEventToEnvelope", () => {
    it("cria EventEnvelope", () => {
      const event: DomainEvent = {
        eventType: "test",
        entityKind: "test",
        entityId: null,
        payload: {},
        metadata: {},
        occurredAt: new Date().toISOString(),
        correlationId: "c1",
      };
      const envelope = adaptDomainEventToEnvelope(event, mockTenantContext);
      expect(envelope.event).toBe(event);
      expect(envelope.tenantContext).toBe(mockTenantContext);
      expect(envelope.envelopeId).toBeDefined();
    });
  });
});
