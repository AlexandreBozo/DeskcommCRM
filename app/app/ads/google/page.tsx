import { redirect } from "next/navigation";

import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { ROLE_RANK } from "@/lib/auth/types";
import { googleAdsConnectionSummary } from "@/lib/plataformas-de-anuncio/google/connection";
import { googleAdsAppCredentialSummary } from "@/lib/plataformas-de-anuncio/google/credentials";
import { createAdminClient } from "@/lib/supabase/admin";

import { GoogleAdsClient } from "./_components/GoogleAdsClient";

export const metadata = { title: "Google Ads" };
export const dynamic = "force-dynamic";

export default async function GoogleAdsPage() {
  const user = await requireAuth();
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg) redirect("/app");
  if (!(user.is_platform_admin && !user.support) && ROLE_RANK[activeOrg.role] < ROLE_RANK.manager) {
    redirect("/403");
  }

  const admin = createAdminClient();
  const [connection, credentials] = await Promise.all([
    googleAdsConnectionSummary(admin, activeOrg.orgId),
    googleAdsAppCredentialSummary(admin, activeOrg.orgId),
  ]);
  const configured = credentials.configured;
  const canConnect = (user.is_platform_admin && !user.support) || ROLE_RANK[activeOrg.role] >= ROLE_RANK.admin;

  return (
    <div data-superficie="clara" className="-m-6 flex min-h-[calc(100%+3rem)] flex-col gap-6 bg-bg p-6 text-text">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Google Ads</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Indicadores operacionais das campanhas do Google Ads. As consultas também gravam histórico diário para que o dashboard não dependa apenas do estado atual da plataforma.
        </p>
      </header>

      {!configured ? (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-5 text-sm">
          <p className="font-medium">Google Ads ainda não está configurado.</p>
          <p className="mt-1 text-muted-foreground">Configure o OAuth e faça o login diretamente em Configurações → Google Ads.</p>
        </div>
      ) : !connection.connected ? (
        <div className="rounded-md border p-6 text-sm">
          <p className="font-medium">Nenhuma conta do Google Ads conectada.</p>
          <p className="mt-1 text-muted-foreground">
            {canConnect
              ? "Conecte a conta em Configurações para começar a importar campanhas e indicadores."
              : "Peça a um administrador da organização para conectar o Google Ads em Configurações."}
          </p>
          {canConnect && (
            <a className="mt-4 inline-block rounded-md border px-4 py-2 font-medium hover:bg-muted" href="/app/settings/google-ads">
              Configurar Google Ads
            </a>
          )}
        </div>
      ) : (
        <GoogleAdsClient defaultCustomerId={connection.defaultCustomerId} />
      )}
    </div>
  );
}
