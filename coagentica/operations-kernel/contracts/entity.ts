/**
 * Contratos canônicos de entidade para o Operations Kernel.
 *
 * EntityRef, EntitySnapshot e RelationshipRef são tipos puros e imutáveis.
 * O Operations Kernel é compartilhado/stateless e NÃO conhece tenant-runtime,
 * Deskcomm ou Hermes. Toda entidade é tenant-bound por tenantId + entityId.
 *
 * Nenhum import de @/lib, tenant-runtime ou business-engine é permitido aqui.
 */

/** Referência canônica a uma entidade dentro de um tenant. */
export interface EntityRef {
  readonly entityId: string;
  readonly tenantId: string;
  readonly entityKind: string;
}

/** Snapshot imutável do estado de uma entidade em um dado momento. */
export interface EntitySnapshot<T = Record<string, unknown>> {
  readonly ref: EntityRef;
  readonly version: number;
  readonly data: T;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly source: string;
}

/** Referência a uma relação entre duas entidades do mesmo tenant. */
export interface RelationshipRef {
  readonly sourceEntityId: string;
  readonly targetEntityId: string;
  readonly tenantId: string;
  readonly relationshipType: string;
  readonly sourceRole?: string;
  readonly targetRole?: string;
}

function isNonBlank(value: string): value is string {
  return typeof value === "string" && value.trim() !== "";
}

export function createEntityRef(params: {
  entityId: string;
  tenantId: string;
  entityKind: string;
}): EntityRef {
  if (!isNonBlank(params.entityId)) {
    throw new Error("entityId é obrigatório");
  }
  if (!isNonBlank(params.tenantId)) {
    throw new Error("tenantId é obrigatório");
  }
  if (!isNonBlank(params.entityKind)) {
    throw new Error("entityKind é obrigatório");
  }
  return {
    entityId: params.entityId.trim(),
    tenantId: params.tenantId.trim(),
    entityKind: params.entityKind.trim(),
  };
}

export function createEntitySnapshot<T = Record<string, unknown>>(params: {
  ref: EntityRef;
  version: number;
  data: T;
  createdAt?: string;
  updatedAt?: string;
  source: string;
}): EntitySnapshot<T> {
  if (!params.ref) {
    throw new Error("ref é obrigatório");
  }
  if (params.version < 0) {
    throw new Error("version deve ser >= 0");
  }
  if (!params.source || params.source.trim() === "") {
    throw new Error("source é obrigatório");
  }
  const now = new Date().toISOString();
  return {
    ref: params.ref,
    version: params.version,
    data: structuredClone(params.data) as T,
    createdAt: params.createdAt ?? now,
    updatedAt: params.updatedAt ?? now,
    source: params.source.trim(),
  };
}

export function createRelationshipRef(params: {
  sourceEntityId: string;
  targetEntityId: string;
  tenantId: string;
  relationshipType: string;
  sourceRole?: string;
  targetRole?: string;
}): RelationshipRef {
  if (!isNonBlank(params.sourceEntityId)) {
    throw new Error("sourceEntityId é obrigatório");
  }
  if (!isNonBlank(params.targetEntityId)) {
    throw new Error("targetEntityId é obrigatório");
  }
  if (!isNonBlank(params.tenantId)) {
    throw new Error("tenantId é obrigatório");
  }
  if (!isNonBlank(params.relationshipType)) {
    throw new Error("relationshipType é obrigatório");
  }
  return {
    sourceEntityId: params.sourceEntityId.trim(),
    targetEntityId: params.targetEntityId.trim(),
    tenantId: params.tenantId.trim(),
    relationshipType: params.relationshipType.trim(),
    sourceRole: params.sourceRole?.trim(),
    targetRole: params.targetRole?.trim(),
  };
}

export function isEntityRefBoundToTenant(ref: EntityRef, tenantId: string): boolean {
  return ref.tenantId === tenantId;
}

export function validateEntityRef(ref: EntityRef): readonly string[] {
  const errors: string[] = [];
  if (!isNonBlank(ref.entityId)) errors.push("entityId é obrigatório");
  if (!isNonBlank(ref.tenantId)) errors.push("tenantId é obrigatório");
  if (!isNonBlank(ref.entityKind)) errors.push("entityKind é obrigatório");
  return errors;
}

export function validateRelationshipRef(ref: RelationshipRef): readonly string[] {
  const errors: string[] = [];
  if (!isNonBlank(ref.sourceEntityId)) errors.push("sourceEntityId é obrigatório");
  if (!isNonBlank(ref.targetEntityId)) errors.push("targetEntityId é obrigatório");
  if (!isNonBlank(ref.tenantId)) errors.push("tenantId é obrigatório");
  if (!isNonBlank(ref.relationshipType)) errors.push("relationshipType é obrigatório");
  return errors;
}
