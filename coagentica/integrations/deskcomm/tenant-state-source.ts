import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type {
  TenantStateSourceData,
  TenantStateSourcePort,
} from "@/coagentica/tenant-runtime/ports/state-source";
import {
  adaptAiKnowledgeSourceToEntitySnapshot,
  adaptAiKnowledgeSourceToKnowledgeSource,
  adaptContactToEntitySnapshot,
  adaptOrganizationToEntitySnapshot,
  adaptOrgGoalToGoal,
  adaptOrgMemoryToEntitySnapshot,
  adaptOrgMemoryToMemoryEntry,
  adaptSkillToCapability,
  capabilityToOrgRelationship,
  contactToOrgRelationship,
  knowledgeToOrgRelationship,
  memoryToOrgRelationship,
} from "./state-adapters";

type OrgRow = Database["public"]["Tables"]["organizations"]["Row"];
type ContactRow = Database["public"]["Tables"]["contacts"]["Row"];
type OrgMemoryRow = Database["public"]["Tables"]["org_memory_entries"]["Row"];
type OrgGoalRow = Database["public"]["Tables"]["org_goals"]["Row"];
type AiKnowledgeSourceRow =
  Database["public"]["Tables"]["ai_knowledge_sources"]["Row"];
type SkillPointerRow = Database["public"]["Tables"]["skill_pointers"]["Row"];
type SkillVersionRow = Database["public"]["Tables"]["skill_versions"]["Row"];

export interface DeskcommTenantStateRows {
  readonly organization: OrgRow | null;
  readonly contacts: readonly ContactRow[];
  readonly memoryEntries: readonly OrgMemoryRow[];
  readonly goals: readonly OrgGoalRow[];
  readonly knowledgeSources: readonly AiKnowledgeSourceRow[];
  readonly skillPointers: readonly SkillPointerRow[];
  readonly skillVersions: readonly SkillVersionRow[];
}

export interface DeskcommTenantStateQueryPort {
  loadRows(tenantId: string): Promise<DeskcommTenantStateRows>;
}

function requireTenantId(tenantId: string): string {
  const normalized = tenantId.trim();
  if (!normalized) {
    throw new Error("tenantId é obrigatório");
  }
  return normalized;
}

function assertTenantRows<T>(
  rows: readonly T[],
  tenantId: string,
  label: string,
  getTenantId: (row: T) => string
): void {
  for (const row of rows) {
    if (getTenantId(row) !== tenantId) {
      throw new Error(`${label} retornou linha de outro tenant`);
    }
  }
}

function selectEffectiveSkillPointers(
  pointers: readonly SkillPointerRow[],
  tenantId: string
): readonly SkillPointerRow[] {
  const selected = new Map<string, SkillPointerRow>();

  for (const pointer of pointers) {
    if (pointer.organization_id === null) {
      selected.set(pointer.name, pointer);
    }
  }

  for (const pointer of pointers) {
    if (pointer.organization_id === tenantId) {
      selected.set(pointer.name, pointer);
    } else if (
      pointer.organization_id !== null &&
      pointer.organization_id !== tenantId
    ) {
      throw new Error("skill pointer retornou linha de outro tenant");
    }
  }

  return [...selected.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function resolveEffectiveSkills(params: {
  pointers: readonly SkillPointerRow[];
  versions: readonly SkillVersionRow[];
  tenantId: string;
}) {
  const versionsById = new Map(params.versions.map((version) => [version.id, version]));
  const selectedPointers = selectEffectiveSkillPointers(
    params.pointers,
    params.tenantId
  );

  return selectedPointers.map((pointer) => {
    const version = versionsById.get(pointer.version_id);
    if (!version) {
      throw new Error(`skill version ausente para pointer ${pointer.name}`);
    }
    return { pointer, version };
  });
}

export function createDeskcommTenantStateSource(
  query: DeskcommTenantStateQueryPort
): TenantStateSourcePort {
  return {
    async loadTenantState(tenantId: string): Promise<TenantStateSourceData> {
      const normalizedTenantId = requireTenantId(tenantId);
      const rows = await query.loadRows(normalizedTenantId);

      if (!rows.organization) {
        throw new Error("tenant não encontrado");
      }
      if (rows.organization.id !== normalizedTenantId) {
        throw new Error("organization retornou outro tenant");
      }

      assertTenantRows(
        rows.contacts,
        normalizedTenantId,
        "contacts",
        (row) => row.organization_id
      );
      assertTenantRows(
        rows.memoryEntries,
        normalizedTenantId,
        "org_memory_entries",
        (row) => row.organization_id
      );
      assertTenantRows(
        rows.goals,
        normalizedTenantId,
        "org_goals",
        (row) => row.organization_id
      );
      assertTenantRows(
        rows.knowledgeSources,
        normalizedTenantId,
        "ai_knowledge_sources",
        (row) => row.organization_id
      );

      const effectiveSkills = resolveEffectiveSkills({
        pointers: rows.skillPointers,
        versions: rows.skillVersions,
        tenantId: normalizedTenantId,
      });

      const entities = [
        adaptOrganizationToEntitySnapshot(rows.organization),
        ...rows.contacts.map(adaptContactToEntitySnapshot),
        ...rows.memoryEntries.map(adaptOrgMemoryToEntitySnapshot),
        ...rows.knowledgeSources.map(adaptAiKnowledgeSourceToEntitySnapshot),
      ];

      const relationships = [
        ...rows.contacts.map(contactToOrgRelationship),
        ...rows.memoryEntries.map(memoryToOrgRelationship),
        ...rows.knowledgeSources.map(knowledgeToOrgRelationship),
        ...effectiveSkills.map(({ pointer, version }) =>
          capabilityToOrgRelationship({
            pointer,
            version,
            targetTenantId: normalizedTenantId,
          })
        ),
      ];

      return {
        tenantId: normalizedTenantId,
        entities,
        relationships,
        knowledgeSources: rows.knowledgeSources.map(
          adaptAiKnowledgeSourceToKnowledgeSource
        ),
        memoryEntries: rows.memoryEntries.map(adaptOrgMemoryToMemoryEntry),
        goals: rows.goals.map((row) => adaptOrgGoalToGoal(row, normalizedTenantId)),
        capabilities: effectiveSkills.map(({ pointer, version }) =>
          adaptSkillToCapability({
            pointer,
            version,
            targetTenantId: normalizedTenantId,
          })
        ),
        sourceVersion: 1,
      };
    },
  };
}

function resultData<T>(
  result: { data: T | null; error: { message: string } | null },
  context: string
): T {
  if (result.error) {
    throw new Error(`${context}: ${result.error.message}`);
  }
  if (result.data === null) {
    throw new Error(`${context}: resposta sem data`);
  }
  return result.data;
}

/**
 * Implementação concreta para o schema Deskcomm/Supabase.
 *
 * O client pode ser service-role; por isso TODO acesso multi-tenant usa filtro
 * explícito por id/organization_id antes de os dados entrarem no Operations Core.
 */
export function createSupabaseDeskcommTenantStateQueryPort(
  client: SupabaseClient<Database>
): DeskcommTenantStateQueryPort {
  return {
    async loadRows(tenantId: string): Promise<DeskcommTenantStateRows> {
      const normalizedTenantId = requireTenantId(tenantId);

      const [
        organizationResult,
        contactsResult,
        memoryResult,
        goalsResult,
        knowledgeResult,
        tenantPointersResult,
        platformPointersResult,
      ] = await Promise.all([
        client
          .from("organizations")
          .select("*")
          .eq("id", normalizedTenantId)
          .maybeSingle(),
        client
          .from("contacts")
          .select("*")
          .eq("organization_id", normalizedTenantId)
          .eq("is_anonymized", false)
          .order("created_at", { ascending: true })
          .order("id", { ascending: true }),
        client
          .from("org_memory_entries")
          .select("*")
          .eq("organization_id", normalizedTenantId)
          .in("status", ["active", "proposed"])
          .order("created_at", { ascending: true })
          .order("id", { ascending: true }),
        client
          .from("org_goals")
          .select("*")
          .eq("organization_id", normalizedTenantId)
          .order("created_at", { ascending: true })
          .order("id", { ascending: true }),
        client
          .from("ai_knowledge_sources")
          .select("*")
          .eq("organization_id", normalizedTenantId)
          .order("name", { ascending: true })
          .order("id", { ascending: true }),
        client
          .from("skill_pointers")
          .select("*")
          .eq("organization_id", normalizedTenantId)
          .order("name", { ascending: true }),
        client
          .from("skill_pointers")
          .select("*")
          .is("organization_id", null)
          .order("name", { ascending: true }),
      ]);

      const organization = resultData(
        organizationResult,
        "organizations query falhou"
      );
      const contacts = resultData(contactsResult, "contacts query falhou");
      const memoryEntries = resultData(
        memoryResult,
        "org_memory_entries query falhou"
      );
      const goals = resultData(goalsResult, "org_goals query falhou");
      const knowledgeSources = resultData(
        knowledgeResult,
        "ai_knowledge_sources query falhou"
      );
      const tenantPointers = resultData(
        tenantPointersResult,
        "tenant skill_pointers query falhou"
      );
      const platformPointers = resultData(
        platformPointersResult,
        "platform skill_pointers query falhou"
      );

      const effectivePointers = selectEffectiveSkillPointers(
        [...platformPointers, ...tenantPointers],
        normalizedTenantId
      );
      const versionIds = [...new Set(effectivePointers.map((p) => p.version_id))];

      let skillVersions: SkillVersionRow[] = [];
      if (versionIds.length > 0) {
        const versionsResult = await client
          .from("skill_versions")
          .select("*")
          .in("id", versionIds);

        skillVersions = resultData(
          versionsResult,
          "skill_versions query falhou"
        );

        for (const version of skillVersions) {
          if (
            version.organization_id !== null &&
            version.organization_id !== normalizedTenantId
          ) {
            throw new Error("skill_versions retornou linha de outro tenant");
          }
        }
      }

      return {
        organization,
        contacts,
        memoryEntries,
        goals,
        knowledgeSources,
        skillPointers: effectivePointers,
        skillVersions,
      };
    },
  };
}
