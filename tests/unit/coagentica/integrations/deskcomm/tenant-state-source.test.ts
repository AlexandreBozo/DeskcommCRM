import { describe, expect, it } from "vitest";
import type { Database } from "@/lib/database.types";
import {
  createDeskcommTenantStateSource,
  type DeskcommTenantStateRows,
} from "@/coagentica/integrations/deskcomm/tenant-state-source";

type OrgRow = Database["public"]["Tables"]["organizations"]["Row"];
type ContactRow = Database["public"]["Tables"]["contacts"]["Row"];
type MemoryRow = Database["public"]["Tables"]["org_memory_entries"]["Row"];
type KnowledgeRow =
  Database["public"]["Tables"]["ai_knowledge_sources"]["Row"];
type SkillPointerRow =
  Database["public"]["Tables"]["skill_pointers"]["Row"];
type SkillVersionRow =
  Database["public"]["Tables"]["skill_versions"]["Row"];

const iso = "2026-09-01T10:00:00.000Z";

function org(id = "tenant-1"): OrgRow {
  return {
    id,
    display_name: "Tenant One",
    legal_name: "Tenant One Ltda",
    slug: "tenant-one",
    status: "active",
    locale: "pt-BR",
    timezone: "America/Sao_Paulo",
    currency: "BRL",
    settings: {},
    onboarding_state: {},
    rate_limit_rps: 10,
    media_retention_days: 30,
    ai_budget_cents: null,
    cnpj: null,
    created_at: iso,
    updated_at: iso,
    created_by: null,
    dpo_email: null,
    onboarded_at: iso,
    privacy_policy_url: null,
    redacted_at: null,
    suspended_at: null,
    suspended_by: null,
    suspended_reason: null,
  };
}

function contact(tenantId = "tenant-1"): ContactRow {
  return {
    id: "contact-1",
    organization_id: tenantId,
    display_name: "Maria",
    name: "Maria",
    email: "maria@example.com",
    email_normalized: "maria@example.com",
    phone_number: "+5511999999999",
    tags: [],
    source: "whatsapp",
    source_metadata: {},
    consent: {},
    custom_fields: {},
    force_human: false,
    is_anonymized: false,
    is_blocked: false,
    is_merged_into: null,
    wa_identity: null,
    wa_lid: null,
    locale: "pt-BR",
    ai_authorized_at: null,
    ai_authorized_reason: null,
    anonymized_at: null,
    avatar_storage_path: null,
    avatar_updated_at: null,
    birthdate: null,
    blocked_at: null,
    blocked_reason: null,
    cpf_encrypted: null,
    cpf_hash: null,
    created_at: iso,
    created_by_user_id: null,
    last_activity_at: iso,
    merged_at: null,
    phone_lookup_at: null,
    updated_at: iso,
  };
}

function memory(tenantId = "tenant-1"): MemoryRow {
  return {
    id: "memory-1",
    organization_id: tenantId,
    title: "Preferência comercial",
    body: "Priorizar atendimento consultivo",
    source: "manual",
    status: "active",
    proposal_id: null,
    created_by: null,
    created_at: iso,
    updated_at: iso,
  };
}

function knowledge(tenantId = "tenant-1"): KnowledgeRow {
  return {
    id: "knowledge-1",
    organization_id: tenantId,
    name: "Catálogo",
    source_type: "document",
    source_metadata: {},
    status: "active",
    is_active: true,
    chunks_count: 10,
    active_kb_version_id: null,
    agent_id: null,
    ingested_at: iso,
    last_index_error: null,
    last_index_status: "indexed",
    last_indexed_at: iso,
    created_at: iso,
    updated_at: iso,
  };
}

function pointer(
  name: string,
  versionId: string,
  tenantId: string | null
): SkillPointerRow {
  return {
    name,
    version_id: versionId,
    organization_id: tenantId,
    updated_at: iso,
  };
}

function version(
  id: string,
  tenantId: string | null,
  description: string
): SkillVersionRow {
  return {
    id,
    organization_id: tenantId,
    name: "sales",
    description,
    body: "body",
    manifest: {},
    matcher: {},
    created_at: iso,
    forked_from_version_id: null,
  };
}

function rows(overrides: Partial<DeskcommTenantStateRows> = {}): DeskcommTenantStateRows {
  return {
    organization: org(),
    contacts: [contact()],
    memoryEntries: [memory()],
    goals: [],
    knowledgeSources: [knowledge()],
    skillPointers: [pointer("sales", "v-tenant", "tenant-1")],
    skillVersions: [version("v-tenant", "tenant-1", "tenant skill")],
    ...overrides,
  };
}

describe("coagentica/integrations/deskcomm/tenant-state-source", () => {
  it("projeta dados reais do Deskcomm em slices do tenant state", async () => {
    const source = createDeskcommTenantStateSource({
      async loadRows() {
        return rows();
      },
    });

    const state = await source.loadTenantState("tenant-1");

    expect(state.tenantId).toBe("tenant-1");
    expect(state.entities).toHaveLength(4);
    expect(state.relationships).toHaveLength(4);
    expect(state.memoryEntries).toHaveLength(1);
    expect(state.knowledgeSources).toHaveLength(1);
    expect(state.goals).toEqual([]);
    expect(state.capabilities).toHaveLength(1);
    expect(state.capabilities[0]?.tenantId).toBe("tenant-1");
  });

  it("tenant skill sobrescreve skill global de mesmo nome", async () => {
    const source = createDeskcommTenantStateSource({
      async loadRows() {
        return rows({
          skillPointers: [
            pointer("sales", "v-global", null),
            pointer("sales", "v-tenant", "tenant-1"),
          ],
          skillVersions: [
            version("v-global", null, "global skill"),
            version("v-tenant", "tenant-1", "tenant skill"),
          ],
        });
      },
    });

    const state = await source.loadTenantState("tenant-1");

    expect(state.capabilities).toHaveLength(1);
    expect(state.capabilities[0]?.config.versionId).toBe("v-tenant");
  });

  it("projeta skill global explicitamente para o tenant", async () => {
    const source = createDeskcommTenantStateSource({
      async loadRows() {
        return rows({
          skillPointers: [pointer("sales", "v-global", null)],
          skillVersions: [version("v-global", null, "global skill")],
        });
      },
    });

    const state = await source.loadTenantState("tenant-1");

    expect(state.capabilities[0]?.tenantId).toBe("tenant-1");
    expect(state.capabilities[0]?.metadata.platformScoped).toBe(true);
  });

  it("rejeita contato de outro tenant", async () => {
    const source = createDeskcommTenantStateSource({
      async loadRows() {
        return rows({ contacts: [contact("tenant-2")] });
      },
    });

    await expect(source.loadTenantState("tenant-1")).rejects.toThrow(
      "contacts retornou linha de outro tenant"
    );
  });

  it("rejeita organização diferente do tenant solicitado", async () => {
    const source = createDeskcommTenantStateSource({
      async loadRows() {
        return rows({ organization: org("tenant-2") });
      },
    });

    await expect(source.loadTenantState("tenant-1")).rejects.toThrow(
      "organization retornou outro tenant"
    );
  });

  it("rejeita pointer sem versão correspondente", async () => {
    const source = createDeskcommTenantStateSource({
      async loadRows() {
        return rows({ skillVersions: [] });
      },
    });

    await expect(source.loadTenantState("tenant-1")).rejects.toThrow(
      "skill version ausente para pointer sales"
    );
  });
});
