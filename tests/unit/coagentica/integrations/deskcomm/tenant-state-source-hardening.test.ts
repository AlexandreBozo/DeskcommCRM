import { describe, expect, it } from "vitest";
import type { Database } from "@/lib/database.types";
import { createDeskcommTenantStateSource, type DeskcommTenantStateRows } from "@/coagentica/integrations/deskcomm/tenant-state-source";

type OrgRow = Database["public"]["Tables"]["organizations"]["Row"];
type MemoryRow = Database["public"]["Tables"]["org_memory_entries"]["Row"];
type KnowledgeRow = Database["public"]["Tables"]["ai_knowledge_sources"]["Row"];
type SkillPointerRow = Database["public"]["Tables"]["skill_pointers"]["Row"];
type SkillVersionRow = Database["public"]["Tables"]["skill_versions"]["Row"];

const iso = "2026-09-01T10:00:00.000Z";
const org = (id = "tenant-1") => ({ id, display_name: "T", legal_name: "T", slug: "t", status: "active", locale: "pt-BR", timezone: "UTC", currency: "BRL", settings: {}, onboarding_state: {}, rate_limit_rps: 10, media_retention_days: 30, created_at: iso, updated_at: iso } as unknown as OrgRow);
const memory = (tenantId: string) => ({ id: "m-1", organization_id: tenantId, title: "M", body: "B", source: "manual", status: "active", created_at: iso, updated_at: iso } as unknown as MemoryRow);
const knowledge = (tenantId: string) => ({ id: "k-1", organization_id: tenantId, name: "K", source_type: "document", is_active: true, status: "active", chunks_count: 1, created_at: iso, updated_at: iso } as unknown as KnowledgeRow);
const pointer = (tenantId: string | null, versionId = "v-1") => ({ name: "sales", organization_id: tenantId, version_id: versionId, updated_at: iso } as SkillPointerRow);
const version = (tenantId: string | null, id = "v-1") => ({ id, organization_id: tenantId, name: "sales", description: "S", body: "body", manifest: {}, matcher: {}, created_at: iso, forked_from_version_id: null } as SkillVersionRow);

function base(overrides: Partial<DeskcommTenantStateRows> = {}): DeskcommTenantStateRows {
  return { organization: org(), contacts: [], memoryEntries: [], goals: [], knowledgeSources: [], skillPointers: [pointer("tenant-1")], skillVersions: [version("tenant-1")], ...overrides };
}

function source(rows: DeskcommTenantStateRows) {
  return createDeskcommTenantStateSource({ async loadRows() { return rows; } });
}

describe("deskcomm tenant state source hardening", () => {
  it("rejeita tenantId vazio", async () => {
    await expect(source(base()).loadTenantState("  ")).rejects.toThrow("tenantId é obrigatório");
  });

  it("rejeita tenant inexistente", async () => {
    await expect(source(base({ organization: null })).loadTenantState("tenant-1")).rejects.toThrow("tenant não encontrado");
  });

  it("rejeita memory de outro tenant", async () => {
    await expect(source(base({ memoryEntries: [memory("tenant-2")] })).loadTenantState("tenant-1")).rejects.toThrow("org_memory_entries retornou linha de outro tenant");
  });

  it("rejeita knowledge de outro tenant", async () => {
    await expect(source(base({ knowledgeSources: [knowledge("tenant-2")] })).loadTenantState("tenant-1")).rejects.toThrow("ai_knowledge_sources retornou linha de outro tenant");
  });

  it("rejeita pointer de outro tenant", async () => {
    await expect(source(base({ skillPointers: [pointer("tenant-2")] })).loadTenantState("tenant-1")).rejects.toThrow("skill pointer retornou linha de outro tenant");
  });

  it("rejeita pointer/version de tenants diferentes", async () => {
    await expect(source(base({ skillPointers: [pointer("tenant-1")], skillVersions: [version("tenant-2")] })).loadTenantState("tenant-1")).rejects.toThrow("skill pointer e versão pertencem a tenants diferentes");
  });
});
