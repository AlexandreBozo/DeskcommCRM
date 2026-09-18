/**
 * Adapters read-only do Deskcomm para o estado canônico da Coagentica.
 *
 * Regra: adapters traduzem fatos existentes. Não inventam memória, objetivo,
 * conhecimento ou capability onde a fonte não sustenta esse significado.
 */

import type { Database } from "@/lib/database.types";
import type {
  EntityRef,
  EntitySnapshot,
  RelationshipRef,
} from "@/coagentica/operations-kernel/contracts/entity";
import {
  createEntityRef,
  createEntitySnapshot,
  createRelationshipRef,
} from "@/coagentica/operations-kernel/contracts/entity";
import type {
  KnowledgeSourceStatus,
  KnowledgeSourceType,
  TenantCapability,
  TenantGoal,
  TenantKnowledgeSource,
  TenantMemoryEntry,
} from "@/coagentica/tenant-runtime/contracts/state";
import {
  createCapability,
  createGoal,
  createKnowledgeSource,
  createMemoryEntry,
} from "@/coagentica/tenant-runtime/contracts/state";

type OrgRow = Database["public"]["Tables"]["organizations"]["Row"];
type ContactRow = Database["public"]["Tables"]["contacts"]["Row"];
type OrgMemoryRow =
  Database["public"]["Tables"]["org_memory_entries"]["Row"];
export type OrgGoalRow = Database["public"]["Tables"]["org_goals"]["Row"];
type AiKnowledgeSourceRow =
  Database["public"]["Tables"]["ai_knowledge_sources"]["Row"];
type SkillVersionRow =
  Database["public"]["Tables"]["skill_versions"]["Row"];
type SkillPointerRow =
  Database["public"]["Tables"]["skill_pointers"]["Row"];

function mapKnowledgeType(sourceType: string): KnowledgeSourceType {
  switch (sourceType) {
    case "faq":
      return "faq";
    case "policy":
      return "policy";
    case "catalog":
    case "nuvemshop_catalog":
      return "catalog";
    case "conversation":
    case "conversations":
      return "conversation";
    default:
      return "other";
  }
}

function mapKnowledgeStatus(
  source: AiKnowledgeSourceRow
): KnowledgeSourceStatus {
  if (source.status === "failed") return "failed";
  if (source.status === "building") return "processing";
  if (source.status === "archived" || !source.is_active) return "inactive";
  return "active";
}

/**
 * Resolve o tenant de uma capability de skill.
 *
 * Para skill platform-scoped, `targetTenantId` é uma projeção explícita feita
 * pelo caller APÓS autorização/policy. Este adapter é deliberadamente puro e
 * não decide permissão; ele apenas recusa projeção implícita ou ambígua.
 */
function resolveSkillTenantId(params: {
  pointer: SkillPointerRow;
  version: SkillVersionRow;
  targetTenantId?: string;
}): string {
  if (params.pointer.version_id !== params.version.id) {
    throw new Error("skill pointer referencia outra versão");
  }

  const pointerTenant = params.pointer.organization_id;
  const versionTenant = params.version.organization_id;

  if (pointerTenant && versionTenant && pointerTenant !== versionTenant) {
    throw new Error("skill pointer e versão pertencem a tenants diferentes");
  }

  const sourceTenant = pointerTenant ?? versionTenant;
  if (
    params.targetTenantId &&
    sourceTenant &&
    sourceTenant !== params.targetTenantId
  ) {
    throw new Error("skill não pertence ao tenant solicitado");
  }

  const tenantId = sourceTenant ?? params.targetTenantId;
  if (!tenantId || tenantId.trim() === "") {
    throw new Error("targetTenantId é obrigatório para skill global");
  }

  return tenantId;
}

export function adaptOrganizationToEntityRef(org: OrgRow): EntityRef {
  return createEntityRef({
    entityId: org.id,
    tenantId: org.id,
    entityKind: "organization",
  });
}

export function adaptOrganizationToEntitySnapshot(
  org: OrgRow
): EntitySnapshot {
  return createEntitySnapshot({
    ref: adaptOrganizationToEntityRef(org),
    version: 1,
    source: "deskcomm.organizations",
    createdAt: org.created_at,
    updatedAt: org.updated_at,
    data: {
      displayName: org.display_name,
      legalName: org.legal_name,
      slug: org.slug,
      status: org.status,
      locale: org.locale,
      timezone: org.timezone,
      currency: org.currency,
      onboardedAt: org.onboarded_at,
    },
  });
}

export function adaptContactToEntityRef(contact: ContactRow): EntityRef {
  return createEntityRef({
    entityId: contact.id,
    tenantId: contact.organization_id,
    entityKind: "contact",
  });
}

export function adaptContactToEntitySnapshot(
  contact: ContactRow
): EntitySnapshot {
  return createEntitySnapshot({
    ref: adaptContactToEntityRef(contact),
    version: 1,
    source: "deskcomm.contacts",
    createdAt: contact.created_at,
    updatedAt: contact.updated_at,
    data: {
      displayName: contact.display_name,
      name: contact.name,
      email: contact.email,
      phoneNumber: contact.phone_number,
      tags: contact.tags,
      source: contact.source,
      locale: contact.locale,
      lastActivityAt: contact.last_activity_at,
      isBlocked: contact.is_blocked,
      forceHuman: contact.force_human,
      isAnonymized: contact.is_anonymized,
    },
  });
}

export function adaptOrgMemoryToEntityRef(
  entry: OrgMemoryRow
): EntityRef {
  return createEntityRef({
    entityId: entry.id,
    tenantId: entry.organization_id,
    entityKind: "org_memory_entry",
  });
}

export function adaptOrgMemoryToEntitySnapshot(
  entry: OrgMemoryRow
): EntitySnapshot {
  return createEntitySnapshot({
    ref: adaptOrgMemoryToEntityRef(entry),
    version: 1,
    source: "deskcomm.org_memory_entries",
    createdAt: entry.created_at,
    updatedAt: entry.updated_at,
    data: {
      title: entry.title,
      body: entry.body,
      source: entry.source,
      status: entry.status,
      proposalId: entry.proposal_id,
    },
  });
}

const GOAL_STATUSES = new Set(["draft", "active", "completed", "archived"] as const);

export function adaptOrgGoalToGoal(row: OrgGoalRow, tenantId: string): TenantGoal {
  if (row.organization_id !== tenantId) {
    throw new Error("goal não pertence ao tenant solicitado");
  }
  if (!GOAL_STATUSES.has(row.status as "draft" | "active" | "completed" | "archived")) {
    throw new Error(`status de goal inválido: ${row.status}`);
  }

  return createGoal({
    goalId: row.id,
    tenantId,
    name: row.name,
    description: row.description,
    status: row.status as "draft" | "active" | "completed" | "archived",
    metadata: row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
      ? { ...(row.metadata as Record<string, unknown>) }
      : {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(row.completed_at ? { completedAt: row.completed_at } : {}),
  });
}

export function adaptOrgMemoryToMemoryEntry(
  entry: OrgMemoryRow
): TenantMemoryEntry {
  return createMemoryEntry({
    entryId: entry.id,
    tenantId: entry.organization_id,
    type: "note",
    content: entry.body,
    status:
      entry.status === "archived"
        ? "archived"
        : entry.status === "proposed"
          ? "pending"
          : "active",
    metadata: {
      title: entry.title,
      source: entry.source,
      proposalId: entry.proposal_id,
    },
    createdAt: entry.created_at,
    updatedAt: entry.updated_at,
  });
}

export function adaptAiKnowledgeSourceToEntityRef(
  source: AiKnowledgeSourceRow
): EntityRef {
  return createEntityRef({
    entityId: source.id,
    tenantId: source.organization_id,
    entityKind: "ai_knowledge_source",
  });
}

export function adaptAiKnowledgeSourceToEntitySnapshot(
  source: AiKnowledgeSourceRow
): EntitySnapshot {
  return createEntitySnapshot({
    ref: adaptAiKnowledgeSourceToEntityRef(source),
    version: 1,
    source: "deskcomm.ai_knowledge_sources",
    createdAt: source.created_at,
    updatedAt: source.updated_at,
    data: {
      name: source.name,
      sourceType: source.source_type,
      status: source.status,
      isActive: source.is_active,
      chunksCount: source.chunks_count,
      lastIndexStatus: source.last_index_status,
      lastIndexedAt: source.last_indexed_at,
      activeKbVersionId: source.active_kb_version_id,
    },
  });
}

export function adaptAiKnowledgeSourceToKnowledgeSource(
  source: AiKnowledgeSourceRow
): TenantKnowledgeSource {
  return createKnowledgeSource({
    sourceId: source.id,
    tenantId: source.organization_id,
    name: source.name,
    type: mapKnowledgeType(source.source_type),
    status: mapKnowledgeStatus(source),
    metadata: {
      sourceType: source.source_type,
      sourceMetadata: source.source_metadata,
      chunksCount: source.chunks_count,
      lastIndexStatus: source.last_index_status,
      lastIndexedAt: source.last_indexed_at,
      activeKbVersionId: source.active_kb_version_id,
      agentId: source.agent_id,
    },
    createdAt: source.created_at,
    updatedAt: source.updated_at,
  });
}

/**
 * Capability ativa = ponteiro + versão correspondente.
 * Versões isoladas não viram capability automaticamente.
 */
export function adaptSkillToCapability(params: {
  pointer: SkillPointerRow;
  version: SkillVersionRow;
  targetTenantId?: string;
}): TenantCapability {
  const tenantId = resolveSkillTenantId(params);
  const platformScoped =
    params.pointer.organization_id === null &&
    params.version.organization_id === null;

  return createCapability({
    capabilityId: `skill:${params.pointer.name}`,
    tenantId,
    name: params.pointer.name,
    type: "tool",
    status: "available",
    config: {
      versionId: params.version.id,
      manifest: params.version.manifest,
      matcher: params.version.matcher,
    },
    metadata: {
      description: params.version.description,
      forkedFromVersionId: params.version.forked_from_version_id,
      platformScoped,
    },
    createdAt: params.version.created_at,
    updatedAt: params.pointer.updated_at,
  });
}

export function contactToOrgRelationship(
  contact: ContactRow
): RelationshipRef {
  return createRelationshipRef({
    sourceEntityId: contact.id,
    targetEntityId: contact.organization_id,
    tenantId: contact.organization_id,
    relationshipType: "contact_belongs_to_organization",
    sourceRole: "contact",
    targetRole: "organization",
  });
}

export function memoryToOrgRelationship(
  entry: OrgMemoryRow
): RelationshipRef {
  return createRelationshipRef({
    sourceEntityId: entry.id,
    targetEntityId: entry.organization_id,
    tenantId: entry.organization_id,
    relationshipType: "memory_belongs_to_organization",
    sourceRole: "memory_entry",
    targetRole: "organization",
  });
}

export function knowledgeToOrgRelationship(
  source: AiKnowledgeSourceRow
): RelationshipRef {
  return createRelationshipRef({
    sourceEntityId: source.id,
    targetEntityId: source.organization_id,
    tenantId: source.organization_id,
    relationshipType: "knowledge_source_belongs_to_organization",
    sourceRole: "knowledge_source",
    targetRole: "organization",
  });
}

export function capabilityToOrgRelationship(params: {
  pointer: SkillPointerRow;
  version: SkillVersionRow;
  targetTenantId?: string;
}): RelationshipRef {
  const tenantId = resolveSkillTenantId(params);
  return createRelationshipRef({
    sourceEntityId: `skill:${params.pointer.name}`,
    targetEntityId: tenantId,
    tenantId,
    relationshipType: "capability_belongs_to_organization",
    sourceRole: "capability",
    targetRole: "organization",
  });
}
