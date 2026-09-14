import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { createSupabaseDeskcommTenantStateQueryPort } from "@/coagentica/integrations/deskcomm/tenant-state-source";

type OrgRow = Database["public"]["Tables"]["organizations"]["Row"];
type ContactRow = Database["public"]["Tables"]["contacts"]["Row"];
type MemoryRow = Database["public"]["Tables"]["org_memory_entries"]["Row"];
type KnowledgeRow = Database["public"]["Tables"]["ai_knowledge_sources"]["Row"];
type SkillPointerRow = Database["public"]["Tables"]["skill_pointers"]["Row"];
type SkillVersionRow = Database["public"]["Tables"]["skill_versions"]["Row"];

interface QueryCall {
  readonly table: string;
  readonly method: string;
  readonly args: readonly unknown[];
}

const iso = "2026-09-01T10:00:00.000Z";

function fixtures() {
  const organization = {
    id: "tenant-1", display_name: "Tenant One", legal_name: "Tenant One Ltda", slug: "tenant-one",
    status: "active", locale: "pt-BR", timezone: "America/Sao_Paulo", currency: "BRL",
    settings: {}, onboarding_state: {}, rate_limit_rps: 10, media_retention_days: 30,
    ai_budget_cents: null, cnpj: null, created_at: iso, updated_at: iso, created_by: null,
    dpo_email: null, onboarded_at: iso, privacy_policy_url: null, redacted_at: null,
    suspended_at: null, suspended_by: null, suspended_reason: null,
  } as unknown as OrgRow;

  const contact = { id: "contact-1", organization_id: "tenant-1", created_at: iso, updated_at: iso, is_anonymized: false } as unknown as ContactRow;
  const memory = { id: "memory-1", organization_id: "tenant-1", title: "M", body: "B", source: "manual", status: "active", created_at: iso, updated_at: iso } as unknown as MemoryRow;
  const knowledge = { id: "knowledge-1", organization_id: "tenant-1", name: "KB", source_type: "document", is_active: true, status: "active", chunks_count: 1, created_at: iso, updated_at: iso } as unknown as KnowledgeRow;
  const tenantPointer = { name: "sales", version_id: "v-tenant", organization_id: "tenant-1", updated_at: iso } as SkillPointerRow;
  const platformPointer = { name: "global", version_id: "v-global", organization_id: null, updated_at: iso } as SkillPointerRow;
  const versions = [
    { id: "v-tenant", organization_id: "tenant-1", name: "sales", description: "Tenant", body: "body", manifest: {}, matcher: {}, created_at: iso, forked_from_version_id: null },
    { id: "v-global", organization_id: null, name: "global", description: "Global", body: "body", manifest: {}, matcher: {}, created_at: iso, forked_from_version_id: null },
  ] as unknown as SkillVersionRow[];

  return { organization, contact, memory, knowledge, tenantPointer, platformPointer, versions };
}

function fakeClient(options?: { versions?: readonly SkillVersionRow[] }) {
  const calls: QueryCall[] = [];
  const f = fixtures();

  class Builder implements PromiseLike<{ data: unknown; error: null }> {
    private readonly localCalls: QueryCall[] = [];
    constructor(private readonly table: string) {}
    private log(method: string, ...args: unknown[]) {
      const call = { table: this.table, method, args } satisfies QueryCall;
      this.localCalls.push(call);
      calls.push(call);
      return this;
    }
    select(...args: unknown[]) { return this.log("select", ...args); }
    eq(...args: unknown[]) { return this.log("eq", ...args); }
    is(...args: unknown[]) { return this.log("is", ...args); }
    in(...args: unknown[]) { return this.log("in", ...args); }
    order(...args: unknown[]) { return this.log("order", ...args); }
    maybeSingle() { this.log("maybeSingle"); return Promise.resolve({ data: f.organization, error: null }); }
    private response() {
      if (this.table === "contacts") return [f.contact];
      if (this.table === "org_memory_entries") return [f.memory];
      if (this.table === "ai_knowledge_sources") return [f.knowledge];
      if (this.table === "skill_versions") return options?.versions ?? f.versions;
      if (this.table === "skill_pointers") {
        const isPlatform = this.localCalls.some((call) => call.method === "is");
        return isPlatform ? [f.platformPointer] : [f.tenantPointer];
      }
      return [];
    }
    then<TResult1 = { data: unknown; error: null }, TReject = never>(
      onfulfilled?: ((value: { data: unknown; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TReject | PromiseLike<TReject>) | null
    ): Promise<TResult1 | TReject> {
      return Promise.resolve({ data: this.response(), error: null }).then(onfulfilled ?? undefined, onrejected ?? undefined);
    }
  }

  const client = { from(table: string) { calls.push({ table, method: "from", args: [] }); return new Builder(table); } } as unknown as SupabaseClient<Database>;
  return { client, calls };
}

function hasCall(calls: readonly QueryCall[], table: string, method: string, ...args: unknown[]) {
  return calls.some((call) => call.table === table && call.method === method && JSON.stringify(call.args) === JSON.stringify(args));
}

describe("createSupabaseDeskcommTenantStateQueryPort", () => {
  it("aplica filtros explícitos por tenant mesmo com service-role", async () => {
    const { client, calls } = fakeClient();
    const query = createSupabaseDeskcommTenantStateQueryPort(client);
    const rows = await query.loadRows("tenant-1");

    expect(rows.organization?.id).toBe("tenant-1");
    expect(hasCall(calls, "organizations", "eq", "id", "tenant-1")).toBe(true);
    expect(hasCall(calls, "contacts", "eq", "organization_id", "tenant-1")).toBe(true);
    expect(hasCall(calls, "contacts", "eq", "is_anonymized", false)).toBe(true);
    expect(hasCall(calls, "org_memory_entries", "eq", "organization_id", "tenant-1")).toBe(true);
    expect(hasCall(calls, "org_memory_entries", "in", "status", ["active", "proposed"])).toBe(true);
    expect(hasCall(calls, "ai_knowledge_sources", "eq", "organization_id", "tenant-1")).toBe(true);
    expect(hasCall(calls, "skill_pointers", "eq", "organization_id", "tenant-1")).toBe(true);
    expect(hasCall(calls, "skill_pointers", "is", "organization_id", null)).toBe(true);
    expect(hasCall(calls, "skill_versions", "in", "id", ["v-global", "v-tenant"])).toBe(true);
  });

  it("rejeita skill_version tenant-scoped de outro tenant", async () => {
    const { client } = fakeClient({
      versions: [{ ...fixtures().versions[0], organization_id: "tenant-2" } as SkillVersionRow],
    });
    const query = createSupabaseDeskcommTenantStateQueryPort(client);

    await expect(query.loadRows("tenant-1")).rejects.toThrow(
      "skill_versions retornou linha de outro tenant"
    );
  });
});
