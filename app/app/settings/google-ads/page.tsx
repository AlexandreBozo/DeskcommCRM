import { redirect } from "next/navigation";

import { Card } from "@/components/ui/card";
import { requireAuth, resolveActiveOrg } from "@/lib/auth/server";
import { ROLE_RANK } from "@/lib/auth/types";
import { googleAdsRedirectUri } from "@/lib/plataformas-de-anuncio/google/config";
import { googleAdsConnectionSummary } from "@/lib/plataformas-de-anuncio/google/connection";
import { googleAdsAppCredentialSummary } from "@/lib/plataformas-de-anuncio/google/credentials";
import { createAdminClient } from "@/lib/supabase/admin";

import { GoogleAdsSettingsClient } from "./_client";

export const metadata = { title: "Google Ads" };
export const dynamic = "force-dynamic";

const ERROR_TEXT: Record<string, string> = {
  conexao_cancelada: "A conexão foi cancelada antes de terminar.",
  retorno_nao_verificavel: "Não consegui verificar o retorno do Google. Inicie a conexão novamente.",
  retorno_incompleto: "O Google voltou sem o código necessário para concluir a conexão.",
  google_ads_nao_configurado: "Configure o Client ID e o Client Secret nesta página antes de entrar com o Google.",
  troca_de_codigo_falhou: "O Google recusou a troca do código OAuth por tokens.",
  permissao_incompleta: "A autorização não concedeu o acesso ao Google Ads.",
  google_ads_api_recusou: "A autorização funcionou, mas a Google Ads API recusou o acesso. Confira o projeto Google Cloud e as permissões da conta.",
  sem_token_de_renovacao: "O Google não devolveu um token de renovação. Reconecte e aprove o consentimento novamente.",
  cifra_indisponivel: "A instalação não conseguiu criptografar as credenciais do Google Ads.",
  nao_consegui_guardar: "A autorização funcionou, mas não consegui guardar a conexão.",
  segredo_indisponivel: "A instalação não consegue assinar o fluxo OAuth com segurança.",
};

export default async function GoogleAdsSettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireAuth();
  const activeOrg = await resolveActiveOrg(user);
  if (!activeOrg) redirect("/app");
  if (!(user.is_platform_admin && !user.support) && ROLE_RANK[activeOrg.role] < ROLE_RANK.admin) {
    redirect("/403");
  }

  const admin = createAdminClient();
  const [connection, credentials] = await Promise.all([
    googleAdsConnectionSummary(admin, activeOrg.orgId),
    googleAdsAppCredentialSummary(admin, activeOrg.orgId),
  ]);
  const params = await searchParams;
  const errorCode = typeof params.erro === "string" ? params.erro : null;
  const ok = params.ok === "1";

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Google Ads</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Configure o acesso e entre com a conta Google diretamente por esta página. A integração continua somente de leitura: não cria, pausa nem altera campanhas.
        </p>
      </header>

      {ok && (
        <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm">
          Login concluído. As contas disponíveis serão descobertas ao abrir o dashboard.
        </div>
      )}

      {errorCode && (
        <div className="rounded-md border border-red-500/40 bg-red-500/10 p-4 text-sm">
          {ERROR_TEXT[errorCode] ?? "Não consegui concluir a conexão com o Google Ads."}
        </div>
      )}

      <div className="rounded-md border border-sky-500/40 bg-sky-500/10 p-4 text-sm">
        <p className="font-medium">Login pela própria tela</p>
        <p className="mt-1 text-muted-foreground">
          Informe uma vez o Client ID e o Client Secret do seu projeto Google Cloud. Depois disso, o botão Entrar com Google abre o consentimento OAuth e o refresh token fica criptografado no servidor.
        </p>
      </div>

      <Card className="flex max-w-3xl flex-col gap-5 p-6">
        <div>
          <p className="font-medium">Conexão Google Ads</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {connection.connected
              ? `Conectado · status ${connection.status ?? "desconhecido"}${connection.defaultCustomerId ? ` · conta padrão ${connection.defaultCustomerId}` : ""}`
              : credentials.configured
                ? "OAuth configurado. Entre com a conta Google que possui acesso ao Google Ads."
                : "Configure o OAuth abaixo e entre com o Google."}
          </p>
        </div>

        <GoogleAdsSettingsClient
          connected={connection.connected}
          configured={credentials.configured}
          initialClientId={credentials.clientId}
          redirectUri={googleAdsRedirectUri()}
        />
      </Card>

      <div className="max-w-3xl rounded-md border p-4 text-sm text-muted-foreground">
        Client Secret, refresh token e qualquer Developer Token legado ficam criptografados. Desconectar remove apenas a autorização da conta; o histórico de campanhas já coletado permanece.
      </div>
    </div>
  );
}
