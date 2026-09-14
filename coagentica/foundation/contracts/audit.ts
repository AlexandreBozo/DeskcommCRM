export interface AuditRecord {
  readonly auditId: string;
  readonly tenantId: string | null;
  readonly action: string;
  readonly actorUserId: string | null;
  readonly actorApiTokenId: string | null;
  readonly resourceType: string | null;
  readonly resourceId: string | null;
  readonly requestId: string | null;
  readonly actorIp: string | null;
  readonly actorUserAgent: string | null;
  readonly bypassedRls: boolean;
  readonly actingAsPlatformAdmin: boolean;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly occurredAt: string;
}

export interface CreateAuditRecordInput {
  readonly auditId: string;
  readonly tenantId?: string | null;
  readonly action: string;
  readonly actorUserId?: string | null;
  readonly actorApiTokenId?: string | null;
  readonly resourceType?: string | null;
  readonly resourceId?: string | null;
  readonly requestId?: string | null;
  readonly actorIp?: string | null;
  readonly actorUserAgent?: string | null;
  readonly bypassedRls?: boolean;
  readonly actingAsPlatformAdmin?: boolean;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly occurredAt: string;
}

function requireNonBlank(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field} é obrigatório`);
  return normalized;
}

export function createAuditRecord(input: CreateAuditRecordInput): AuditRecord {
  const auditId = requireNonBlank(input.auditId, "auditId");
  const action = requireNonBlank(input.action, "action");
  const occurredAt = requireNonBlank(input.occurredAt, "occurredAt");
  if (Number.isNaN(Date.parse(occurredAt))) {
    throw new Error("occurredAt deve ser uma data válida");
  }

  return {
    auditId,
    tenantId: input.tenantId ?? null,
    action,
    actorUserId: input.actorUserId ?? null,
    actorApiTokenId: input.actorApiTokenId ?? null,
    resourceType: input.resourceType ?? null,
    resourceId: input.resourceId ?? null,
    requestId: input.requestId ?? null,
    actorIp: input.actorIp ?? null,
    actorUserAgent: input.actorUserAgent ?? null,
    bypassedRls: input.bypassedRls ?? false,
    actingAsPlatformAdmin: input.actingAsPlatformAdmin ?? false,
    metadata: { ...(input.metadata ?? {}) },
    occurredAt,
  };
}

export function isAuditTenantBound(record: AuditRecord, tenantId: string): boolean {
  return record.tenantId !== null && record.tenantId === tenantId;
}

export function validateAuditRecord(record: AuditRecord): readonly string[] {
  const errors: string[] = [];
  if (!record.auditId?.trim()) errors.push("auditId é obrigatório");
  if (!record.action?.trim()) errors.push("action é obrigatório");
  if (!record.occurredAt?.trim()) {
    errors.push("occurredAt é obrigatório");
  } else if (Number.isNaN(Date.parse(record.occurredAt))) {
    errors.push("occurredAt deve ser uma data válida");
  }
  return errors;
}
