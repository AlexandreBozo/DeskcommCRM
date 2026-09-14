import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  adaptOrganizationToEntityRef,
  adaptOrganizationToEntitySnapshot,
  adaptContactToEntityRef,
  adaptContactToEntitySnapshot,
  adaptOrgMemoryToMemoryEntry,
  adaptAiKnowledgeSourceToKnowledgeSource,
  adaptSkillToCapability,
  contactToOrgRelationship,
  memoryToOrgRelationship,
  knowledgeToOrgRelationship,
  capabilityToOrgRelationship,
} from "@/coagentica/integrations/deskcomm/state-adapters";
import type { Database } from "@/lib/database.types";

type OrgRow = Database["public"]["Tables"]["organizations"]["Row"];
type ContactRow = Database["public"]["Tables"]["contacts"]["Row"];
type MemoryRow = Database["public"]["Tables"]["org_memory_entries"]["Row"];
type KnowledgeRow = Database["public"]["Tables"]["ai_knowledge_sources"]["Row"];
type SkillVersionRow = Database["public"]["Tables"]["skill_versions"]["Row"];
type SkillPointerRow = Database["public"]["Tables"]["skill_pointers"]["Row"];

const iso1 = "2026-09-01T10:00:00.000Z";
const iso2 = "2026-09-02T10:00:00.000Z";

const makeOrg = (): OrgRow =>
  ({
    id: "org-1",
    slug: "test-org",
    display_name: "Test Org",
    legal_name: "Test Legal",
    status: "active",
    locale: "pt-BR",
    timezone: "America/Sao_Paulo",
    currency: "BRL",
    onboarded_at: iso1,
    created_at: iso1,
    updated_at: iso2,
  }) as OrgRow;

const makeContact = (): ContactRow =>
  ({
    id: "contact-1",
    organization_id: "org-1",
    display_name: "Maria",
    name: "Maria Silva",
    email: "maria@example.com",
    phone_number: "+5511999999999",
    tags: ["vip"],
    source: "whatsapp",
    locale: "pt-BR",
    last_activity_at: iso2,
    is_blocked: false,
    force_human: false,
    is_anonymized: false,
    created_at: iso1,
    updated_at: iso2,
  }) as ContactRow;

const makeMemory = (status = "active"): MemoryRow =>
  ({
    id: "mem-1",
    organization_id: "org-1",
    title: "Preferência",
    body: "Cliente prefere atendimento pela manhã",
    source: "manual",
    status,
    proposal_id: null,
    created_by: null,
    created_at: iso1,
    updated_at: iso2,
  }) as MemoryRow;

const makeKnowledge = (
  sourceType = "faq",
  status = "ready",
  isActive = true
): KnowledgeRow =>
  ({
    id: "knowledge-1",
    organization_id: "org-1",
    name: "FAQ comercial",
    source_type: sourceType,
    source_metadata: {},
    is_active: isActive,
    status,
    chunks_count: 12,
    last_index_status: "success",
    last_indexed_at: iso2,
    active_kb_version_id: null,
    agent_id: null,
    ingested_at: iso1,
    last_index_error: null,
    created_at: iso1,
    updated_at: iso2,
  }) as KnowledgeRow;

const makeSkillVersion = (
  organizationId: string | null = "org-1"
): SkillVersionRow =>
  ({
    id: "skill-version-1",
    organization_id: organizationId,
    name: "agendar",
    description: "Agenda um compromisso",
    body: "body",
    manifest: [{ tool: "calendar" }],
    matcher: { any_keywords: ["agendar"] },
    created_at: iso1,
    forked_from_version_id: null,
  }) as SkillVersionRow;

const makeSkillPointer = (
  organizationId: string | null = "org-1"
): SkillPointerRow =>
  ({
    name: "agendar",
    organization_id: organizationId,
    version_id: "skill-version-1",
    updated_at: iso2,
  }) as SkillPointerRow;

const adapterPath = join(
  process.cwd(),
  "coagentica",
  "integrations",
  "deskcomm",
  "state-adapters.ts"
);

describe("coagentica/integrations/deskcomm/state-adapters", () => {
  it("organização vira entidade, sem fabricar knowledge ou goal", () => {
    const row = makeOrg();
    const ref = adaptOrganizationToEntityRef(row);
    const snapshot = adaptOrganizationToEntitySnapshot(row);

    expect(ref).toMatchObject({
      entityId: "org-1",
      tenantId: "org-1",
      entityKind: "organization",
    });
    expect(snapshot.ref).toEqual(ref);
    expect(snapshot.data).toMatchObject({
      displayName: "Test Org",
      status: "active",
      currency: "BRL",
    });
    expect(snapshot.createdAt).toBe(iso1);
    expect(snapshot.updatedAt).toBe(iso2);
  });

  it("contato vira entidade e relacionamento, não memória", () => {
    const row = makeContact();
    const ref = adaptContactToEntityRef(row);
    const snapshot = adaptContactToEntitySnapshot(row);
    const relationship = contactToOrgRelationship(row);

    expect(ref).toMatchObject({
      entityId: "contact-1",
      tenantId: "org-1",
      entityKind: "contact",
    });
    expect(snapshot.data).toMatchObject({
      displayName: "Maria",
      email: "maria@example.com",
      isBlocked: false,
    });
    expect(relationship).toMatchObject({
      sourceEntityId: "contact-1",
      targetEntityId: "org-1",
      tenantId: "org-1",
    });
  });

  it("org_memory_entries é a fonte canônica de memória", () => {
    const row = makeMemory("proposed");
    const entry = adaptOrgMemoryToMemoryEntry(row);
    const relationship = memoryToOrgRelationship(row);

    expect(entry).toMatchObject({
      entryId: "mem-1",
      tenantId: "org-1",
      type: "note",
      status: "pending",
      createdAt: iso1,
      updatedAt: iso2,
    });
    expect(entry.metadata.title).toBe("Preferência");
    expect(relationship.tenantId).toBe("org-1");
  });

  it("ai_knowledge_sources é a fonte canônica de conhecimento", () => {
    const row = makeKnowledge("nuvemshop_catalog", "building", true);
    const source = adaptAiKnowledgeSourceToKnowledgeSource(row);
    const relationship = knowledgeToOrgRelationship(row);

    expect(source).toMatchObject({
      sourceId: "knowledge-1",
      tenantId: "org-1",
      type: "catalog",
      status: "processing",
      createdAt: iso1,
      updatedAt: iso2,
    });
    expect(relationship.tenantId).toBe("org-1");
  });

  it("skill ativo é ponteiro + versão correspondente", () => {
    const pointer = makeSkillPointer();
    const version = makeSkillVersion();
    const capability = adaptSkillToCapability({ pointer, version });
    const relationship = capabilityToOrgRelationship({ pointer, version });

    expect(capability).toMatchObject({
      capabilityId: "skill:agendar",
      tenantId: "org-1",
      name: "agendar",
      type: "tool",
      status: "available",
      createdAt: iso1,
      updatedAt: iso2,
    });
    expect(capability.config.versionId).toBe("skill-version-1");
    expect(relationship.tenantId).toBe("org-1");
  });

  it("skill global exige projeção explícita para um tenant", () => {
    const pointer = makeSkillPointer(null);
    const version = makeSkillVersion(null);

    expect(() => adaptSkillToCapability({ pointer, version })).toThrow(
      "targetTenantId é obrigatório para skill global"
    );

    const capability = adaptSkillToCapability({
      pointer,
      version,
      targetTenantId: "org-2",
    });

    expect(capability.tenantId).toBe("org-2");
    expect(capability.metadata.platformScoped).toBe(true);
  });

  it("rejeita pointer e versão inconsistentes", () => {
    const pointer = {
      ...makeSkillPointer(),
      version_id: "outra-versao",
    } as SkillPointerRow;

    expect(() =>
      adaptSkillToCapability({ pointer, version: makeSkillVersion() })
    ).toThrow("skill pointer referencia outra versão");
  });

  it("não contém adapters conceitualmente sintéticos", () => {
    const content = readFileSync(adapterPath, "utf-8");

    expect(content).not.toContain("adaptContactToMemoryEntry");
    expect(content).not.toContain("adaptOrganizationToGoal");
    expect(content).not.toContain("adaptOrganizationToKnowledgeSource");
  });

  it("Deskcomm fica confinado à zona de integração", () => {
    const content = readFileSync(adapterPath, "utf-8");

    expect(content).toContain("@/lib/database.types");
    const forbiddenImports =
      content.match(/from\s+["']@3lib\/(?!database\.types)/g) ?? [];
    expect(forbiddenImports).toHaveLength(0);
  });
});