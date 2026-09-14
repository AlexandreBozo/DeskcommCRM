import { describe, it, expect } from "vitest";
import {
  domainEventFromRecord,
  toEventEnvelope,
  extractCorrelationId,
  extractCausationId,
  eventRecordToEnvelope,
  createDomainEvent,
  createEventEnvelope,
  type SourceEventRecord,
} from "@/coagentica/operations-kernel/contracts/domain-event";
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

const baseEventRow: SourceEventRecord = {
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

describe("coagentica/operations-kernel/contracts/domain-event", () => {
  describe("domainEventFromRecord", () => {
    it("converte SourceEventRecord para DomainEvent preservando campos", () => {
      const event = domainEventFromRecord(baseEventRow, "corr-abc", "cause-xyz");
      expect(event.eventType).toBe("lead.created");
      expect(event.entityKind).toBe("lead");
      expect(event.entityId).toBe("lead-789");
      expect(event.payload).toEqual({ name: "John Doe", value: 100 });
      expect(event.metadata).toEqual({ source: "webhook" });
      expect(event.occurredAt).toBe("2026-01-15T10:30:00Z");
      expect(event.correlationId).toBe("corr-abc");
      expect(event.causationId).toBe("cause-xyz");
    });
  });

  describe("toEventEnvelope", () => {
    it("cria envelope com event, tenantContext e metadados", () => {
      const event = domainEventFromRecord(baseEventRow, "corr-1");
      const envelope = toEventEnvelope(event, mockTenantContext, "env-123");
      expect(envelope.event).toBe(event);
      expect(envelope.tenantContext).toBe(mockTenantContext);
      expect(envelope.envelopeId).toBe("env-123");
      expect(envelope.receivedAt).toBeDefined();
    });
  });

  describe("extractCorrelationId", () => {
    it("extrai correlationId de metadata", () => {
      const row: SourceEventRecord = { ...baseEventRow, metadata: { correlationId: "from-meta" } };
      expect(extractCorrelationId(row)).toBe("from-meta");
    });
  });

  describe("extractCausationId", () => {
    it("retorna undefined quando não há causationId", () => {
      const row: SourceEventRecord = { ...baseEventRow, metadata: {}, payload: {} };
      expect(extractCausationId(row)).toBeUndefined();
    });
  });

  describe("eventRecordToEnvelope", () => {
    it("converte SourceEventRecord completo para EventEnvelope", () => {
      const row: SourceEventRecord = { ...baseEventRow, metadata: { correlationId: "corr-full", causationId: "cause-full" } };
      const envelope = eventRecordToEnvelope(row, mockTenantContext);
      expect(envelope.event.eventType).toBe("lead.created");
      expect(envelope.event.correlationId).toBe("corr-full");
      expect(envelope.event.causationId).toBe("cause-full");
    });
  });

  describe("createDomainEvent", () => {
    it("cria DomainEvent válido", () => {
      const event = createDomainEvent({ eventType: "test.created", entityKind: "test", entityId: "t-1" });
      expect(event.eventType).toBe("test.created");
      expect(event.entityId).toBe("t-1");
    });
    it("lança erro quando eventType está vazio", () => {
      expect(() => createDomainEvent({ eventType: "", entityKind: "test" })).toThrow("eventType é obrigatório");
    });
  });

  describe("createEventEnvelope", () => {
    it("cria EventEnvelope com envelopeId auto-gerado", () => {
      const event = createDomainEvent({ eventType: "test", entityKind: "test" });
      const envelope = createEventEnvelope(event, mockTenantContext);
      expect(envelope.envelopeId).toBeDefined();
      expect(envelope.receivedAt).toBeDefined();
    });
  });
});
