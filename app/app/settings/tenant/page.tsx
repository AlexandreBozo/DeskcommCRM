import { redirect } from "next/navigation";

import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { ROLE_RANK } from "@/lib/auth/types";
import { traduzir } from "@/lib/i18n/dicionario";
import { moedaServidaOu } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { ZonaDePerigoDaOrganizacao } from "./_danger-zone";
import { TenantForm } from "./_form";

export const dynamic = "force-dynamic";

interface OrgRow {
  name: string;
  metadata: Record<string, unknown> | null;
}

function stringMetadata(metadata: Record<string, unknown>, key: string, fallback = ""): string {
  const value = metadata[key];
  return typeof value === "string" ? value : fallback;
}

export default async function TenantSettingsPage() {
  const user = await requireAuth();
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg) redirect("/app");
  if (!(user.is_platform_admin && !user.support) && ROLE_RANK[activeOrg.role] < ROLE_RANK.admin) {
    redirect("/403");
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("organizations")
    .select(
      "name, metadata",
    )
    .eq("id", activeOrg.orgId)
    .maybeSingle();

  const row = (data ?? null) as OrgRow | null;
  const metadata = row?.metadata ?? {};
  const lostReasonsExtra = Array.isArray(metadata.lost_reasons_extra)
    ? metadata.lost_reasons_extra.filter((reason): reason is string => typeof reason === "string")
    : [];
  const idioma = user.idioma;

  return (
    <div className="flex h-full flex-col gap-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{traduzir("Organização", idioma)}</h1>
        <p className="text-sm text-muted-foreground">
          {traduzir("Dados da empresa, retenção de mídia, DPO. Admin only.", idioma)}
        </p>
      </header>
      {row && (
        <TenantForm
          initial={{
            display_name: row.name,
            legal_name: stringMetadata(metadata, "legal_name", row.name),
            cnpj: stringMetadata(metadata, "cnpj") || null,
            timezone: stringMetadata(metadata, "timezone", "America/Sao_Paulo"),
            // `en-US` saiu da lista (nunca teve tradução). Uma linha antiga
            // com ele cai no padrão em vez de quebrar a tela.
            locale: stringMetadata(metadata, "locale") === "es" ? "es" : "pt-BR",
            currency: moedaServidaOu(stringMetadata(metadata, "currency", "BRL")),
            media_retention_days: Number(metadata.media_retention_days) || 365,
            dpo_email: stringMetadata(metadata, "dpo_email") || null,
            privacy_policy_url: stringMetadata(metadata, "privacy_policy_url") || null,
            lost_reasons_extra: lostReasonsExtra,
          }}
        />
      )}
      {row && <ZonaDePerigoDaOrganizacao displayName={row.name} />}
    </div>
  );
}
