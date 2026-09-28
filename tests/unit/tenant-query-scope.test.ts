import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(path, "utf8");

function idMutation(sourceCode: string, table: string, operation: "update" | "delete") {
  const operationPattern =
    operation === "update" ? String.raw`\.update\([\s\S]*?` : String.raw`\.delete\(\)`;
  return sourceCode.match(
    new RegExp(
      String.raw`\.from\("${table}"\)\s*${operationPattern}[\s\S]*?\.eq\("id", id\)[\s\S]*?(?:\.single\(\)|;)`,
      "g",
    ),
  );
}

describe("mutações por id mantêm o tenant na própria query", () => {
  for (const table of ["automation_rules", "webhook_sources"] as const) {
    const route = source(`app/api/v1/${table.replaceAll("_", "-")}/[id]/route.ts`);

    for (const operation of ["update", "delete"] as const) {
      it(`${table} ${operation} repete organization_id`, () => {
        const chains = idMutation(route, table, operation);
        expect(chains, `query ${operation} de ${table} não encontrada`).toHaveLength(1);
        expect(chains?.[0]).toContain('.eq("organization_id", activeOrg.orgId)');
      });
    }
  }
});

describe("o handler compartilhado de mensagens não depende de RLS", () => {
  const handler = source("app/api/v1/messages/_handler.ts");

  it("os dois lookups tolerantes da conversa filtram a organização", () => {
    const lookups = handler.match(
      /\.from\("conversations"\)\s*\.select\([\s\S]*?\.eq\("id", input\.conversation_id\)[\s\S]*?\.maybeSingle\(\)/g,
    );
    expect(lookups).toHaveLength(2);
    for (const lookup of lookups ?? []) {
      expect(lookup).toContain('.eq("organization_id", ctx.organization_id)');
    }
  });

  it("todo update da mensagem por message.id filtra a organização", () => {
    const updates = handler.match(
      /\.from\("messages"\)\s*\.update\([\s\S]*?\.eq\("id", message\.id\)/g,
    );
    expect(updates?.length ?? 0).toBeGreaterThan(1);
    for (const update of updates ?? []) {
      expect(update).toContain('.eq("organization_id", ctx.organization_id)');
    }
  });

  it("o update final da conversa filtra a organização", () => {
    const update = handler.match(
      /\.from\("conversations"\)\s*\.update\(conversationUpdate\)[\s\S]*?\.eq\("id", c\.id\)/,
    )?.[0];
    expect(update).toBeDefined();
    expect(update).toContain('.eq("organization_id", ctx.organization_id)');
  });
});

describe("a migration canônica fecha os vínculos estruturais", () => {
  const migration = source(
    "supabase/migrations/20260928190000_0238_enforce_canonical_tenant_boundaries.sql",
  );

  it("completa os 24 triggers de relações tenant-scoped", () => {
    const relationTriggers = migration.match(
      /create trigger (?!member_roles_same_organization)[a-z_]+_same_organization/g,
    );
    expect(relationTriggers).toHaveLength(24);
  });

  it("impede papel de outra organização na membership", () => {
    expect(migration).toContain("create trigger member_roles_same_organization");
    expect(migration).toContain("cross-tenant member role blocked");
    expect(migration).toContain("member_organization_id is distinct from role_organization_id");
  });

  it("adiciona e valida os 11 vínculos do espelho de mensagens", () => {
    const constraints = [
      "message_contacts_organization_id_fkey",
      "message_conversations_organization_id_fkey",
      "message_records_organization_id_fkey",
      "message_sync_checkpoints_organization_id_fkey",
      "message_contacts_source_fkey",
      "message_conversations_source_fkey",
      "message_conversations_contact_fkey",
      "message_records_source_fkey",
      "message_records_conversation_fkey",
      "message_records_contact_fkey",
      "message_sync_checkpoints_source_fkey",
    ];
    for (const constraint of constraints) expect(migration).toContain(constraint);
    expect(migration).not.toMatch(/not valid/i);
  });

  it("normaliza os quatro papéis padrão para todo tenant ativo", () => {
    for (const code of ["org_admin", "manager", "agent", "viewer"]) {
      expect(migration).toContain(`('${code}',`);
    }
    expect(migration).toContain("on conflict (organization_id, code) do nothing");
  });
});
