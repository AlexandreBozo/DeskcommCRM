import { describe, it, expect } from "vitest";
import {
  domainEventFromRecord,
  toEventEnvelope,
  extractCorrelationId,
  extractCausationId,
  eventRecordToEnvelope,
  type SourceEventRecord,
} from "@/coagentica/foundation/contracts/events";
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

describe("coagentica/foundation/contracts/events", () => {
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

    it("usa created_at da row quando presente", () => {
      const event = domainEventFromRecord(baseEventRow, "corr-1");
      expect(event.occurredAt).toBe("2026-01-15T10:30:00Z");
    });

    it("usa data atual quando created_at não está presente", () => {
      const rowWithoutCreatedAt: SourceEventRecord = { ...baseEventRow, created_at: undefined };
      const before = new Date().toISOString();
      const event = domainEventFromRecord(rowWithoutCreatedAt, "corr-1");
      const after = new Date().toISOString();
      expect(event.occurredAt >= before && event.occurredAt <= after).toBe(true);
    });

    it("não muta payload original", () => {
      const originalPayload = { ...baseEventRow.payload };
      domainEventFromRecord(baseEventRow, "corr-1");
      expect(baseEventRow.payload).toEqual(originalPayload);
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

    it("gera envelopeId automaticamente quando não fornecido", () => {
      const event = domainEventFromRecord(baseEventRow, "corr-1");
      const envelope = toEventEnvelope(event, mockTenantContext);
      expect(envelope.envelopeId).toBeDefined();
      expect(envelope.envelopeId.length).toBeGreaterThan(0);
    });
  });

  describe("extractCorrelationId", () => {
    it("extrai correlationId de metadata", () => {
      const row: SourceEventRecord = {
        ...baseEventRow,
        metadata: { correlationId: "from-meta" },
      };
      expect(extractCorrelationId(row)).toBe("from-meta");
    });

    it("extrai correlationId de payload quando não está em metadata", () => {
      const row: SourceEventRecord = {
        ...baseEventRow,
        metadata: {},
        payload: { correlationId: "from-payload" },
      };
      expect(extractCorrelationId(row)).toBe("from-payload");
    });

    it("usa row.id como fallback quando não há correlationId", () => {
      const row: SourceEventRecord = { ...baseEventRow, metadata: {}, payload: {} };
      expect(extractCorrelationId(row)).toBe("evt-001");
    });

    it("ignora string vazia em metadata e payload", () => {
      const row: SourceEventRecord = {
        ...baseEventRow,
        metadata: { correlationId: "" },
        payload: { correlationId: "  " },
      };
      expect(extractCorrelationId(row)).toBe("evt-001");
    });
  });

  describe("extractCausationId", () => {
    it("extrai causationId de metadata", () => {
      const row: SourceEventRecord = { ...baseEventRow, metadata: { causationId: "cause-meta" } };
      expect(extractCausationId(row)).toBe("cause-meta");
    });

    it("extrai causationId de payload quando não está em metadata", () => {
      const row: SourceEventRecord = {
        ...baseEventRow,
        metadata: {},
        payload: { causationId: "cause-payload" },
      };
      expect(extractCausationId(row)).toBe("cause-payload");
    });

    it("retorna undefined quando não há causationId", () => {
      const row: SourceEventRecord = { ...baseEventRow, metadata: {}, payload: {} };
      expect(extractCausationId(row)).toBeUndefined();
    });
  });

  describe("eventRecordToEnvelope", () => {
    it("converte SourceEventRecord completo para EventEnvelope", () => {
      const row: SourceEventRecord = {
        ...baseEventRow,
        metadata: { correlationId: "corr-full", causationId: "cause-full" },
      };
      const envelope = eventRecordToEnvelope(row, mockTenantContext);
      expect(envelope.event.eventType).toBe("lead.created");
      expect(envelope.event.correlationId).toBe("corr-full");
      expect(envelope.event.causationId).toBe("cause-full");
      expect(envelope.tenantContext.tenantId).toBe("tenant-123");
      expect(envelope.envelopeId).toBeDefined();
      expect(envelope.receivedAt).toBeDefined();
    });

    it("não muta payload original da row", () => {
      const originalPayload = { ...baseEventRow.payload };
      eventRecordToEnvelope(baseEventRow, mockTenantContext);
      expect(baseEventRow.payload).toEqual(originalPayload);
    });

    it("não muta metadata original da row", () => {
      const originalMetadata = { ...baseEventRow.metadata };
      eventRecordToEnvelope(baseEventRow, mockTenantContext);
      expect(baseEventRow.metadata).toEqual(originalMetadata);
    });
  });
});
