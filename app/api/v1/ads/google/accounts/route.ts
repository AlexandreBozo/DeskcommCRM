import { randomUUID } from "node:crypto";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { googleAdsConnectionSummary } from "@/lib/plataformas-de-anuncio/google/connection";
import { discoverGoogleAdsAccounts } from "@/lib/plataformas-de-anuncio/google/sync";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "ads_insights" });
  if (!authz.ok) return authz.response;

  const admin = createAdminClient();
  const connection = await googleAdsConnectionSummary(admin, authz.org.orgId);
  if (!connection.connected) {
    return fail(
      "google_ads_not_connected",
      "Nenhuma conta do Google Ads está conectada para esta organização.",
      422,
      { requestId },
    );
  }

  const discovered = await discoverGoogleAdsAccounts(admin, authz.org.orgId);
  if (!discovered.ok) {
    return fail(
      "google_ads_upstream_error",
      "Não consegui listar as contas do Google Ads agora.",
      502,
      { requestId, details: discovered.detail },
    );
  }

  const latest = await googleAdsConnectionSummary(admin, authz.org.orgId);
  return ok(
    {
      accounts: discovered.accounts,
      default_customer_id: latest.defaultCustomerId,
      login_customer_id: latest.loginCustomerId,
    },
    { requestId },
  );
}
