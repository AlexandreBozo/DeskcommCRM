import { NextResponse, type NextRequest } from "next/server";

import { audit } from "@/lib/audit";
import { verificarEstado } from "@/lib/agenda/google/estado";
import { vinculoConfere } from "@/lib/agenda/google/vinculo";
import { env } from "@/lib/env";
import { supportCallbackWriteAllowed } from "@/lib/impersonate/support";
import {
  listAccessibleGoogleAdsCustomers,
  sessionFromConfig,
} from "@/lib/plataformas-de-anuncio/google/client";
import {
  GOOGLE_ADS_BIND_COOKIE,
  GOOGLE_ADS_CALLBACK_PATH,
} from "@/lib/plataformas-de-anuncio/google/config";
import { readGoogleAdsAppConfig } from "@/lib/plataformas-de-anuncio/google/credentials";
import { exchangeGoogleAdsCode, hasGoogleAdsScope } from "@/lib/plataformas-de-anuncio/google/oauth";
import { createAdminClient } from "@/lib/supabase/admin";
import { cookieSecure } from "@/lib/supabase/cookie-secure";
import { encryptWebhookSecret } from "@/lib/webhooks/secrets";

export const dynamic = "force-dynamic";

function back(parameter: string): NextResponse {
  const target = new URL(`/app/settings/google-ads?${parameter}`, env.NEXT_PUBLIC_APP_URL).toString();
  const safe = target
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

  const response = new NextResponse(
    `<!doctype html><html lang="pt-br"><head><meta charset="utf-8">` +
      `<meta name="robots" content="noindex"><title>Voltando…</title></head><body>` +
      `<p>Voltando para o Google Ads…</p>` +
      `<script>location.replace(${JSON.stringify(target)})</script>` +
      `<noscript><p><a href="${safe}">Continuar</a></p></noscript>` +
      `</body></html>`,
    { status: 200, headers: { "content-type": "text/html; charset=utf-8" } },
  );
  response.cookies.set(GOOGLE_ADS_BIND_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: cookieSecure(),
    path: GOOGLE_ADS_CALLBACK_PATH,
    maxAge: 0,
  });
  return response;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const url = new URL(req.url);
  if (url.searchParams.get("error")) return back("erro=conexao_cancelada");

  const rawState = url.searchParams.get("state");
  const code = url.searchParams.get("code");

  let state: ReturnType<typeof verificarEstado> = null;
  try {
    state = verificarEstado(rawState, { segredo: env.INTERNAL_SECRET, agora: new Date() });
  } catch {
    return back("erro=retorno_nao_verificavel");
  }
  if (!state) return back("erro=retorno_nao_verificavel");

  const { organizationId, userId } = state;
  const binding = req.cookies.get(GOOGLE_ADS_BIND_COOKIE)?.value;
  if (!vinculoConfere(binding, state.nonce, env.INTERNAL_SECRET)) {
    await audit({
      action: "google_ads.conexao_falhou",
      organizationId,
      metadata: { reason: "vinculo_ausente_ou_nao_confere", user_id: userId },
    });
    return back("erro=retorno_nao_verificavel");
  }

  if (!code) return back("erro=retorno_incompleto");
  if (!(await supportCallbackWriteAllowed(organizationId, userId, state.authSessionId))) {
    return back("erro=retorno_nao_verificavel");
  }

  const admin = createAdminClient();
  const config = await readGoogleAdsAppConfig(admin, organizationId);
  if (!config) return back("erro=google_ads_nao_configurado");
  const { error: nonceError } = await admin.from("google_ads_oauth_nonces").insert({
    nonce: state.nonce,
    organization_id: organizationId,
    user_id: userId,
  });
  if (nonceError) {
    await audit({
      action: "google_ads.conexao_falhou",
      organizationId,
      metadata: {
        reason: nonceError.code === "23505" ? "state_reutilizado" : "nonce_indisponivel",
        user_id: userId,
      },
    });
    return back("erro=retorno_nao_verificavel");
  }

  const tokenResult = await exchangeGoogleAdsCode(config, code);
  if (!tokenResult.ok) {
    await audit({
      action: "google_ads.conexao_falhou",
      organizationId,
      actorUserId: userId,
      actorAuthSessionId: state.authSessionId,
      metadata: { reason: "troca_de_codigo_falhou", detail: tokenResult.detail },
    });
    return back("erro=troca_de_codigo_falhou");
  }
  if (!hasGoogleAdsScope(tokenResult.token.scopes)) {
    await audit({
      action: "google_ads.conexao_falhou",
      organizationId,
      actorUserId: userId,
      actorAuthSessionId: state.authSessionId,
      metadata: { reason: "scope_missing" },
    });
    return back("erro=permissao_incompleta");
  }

  const validation = await listAccessibleGoogleAdsCustomers(
    sessionFromConfig(config, tokenResult.token.accessToken),
  );
  if (!validation.ok) {
    await audit({
      action: "google_ads.conexao_falhou",
      organizationId,
      actorUserId: userId,
      actorAuthSessionId: state.authSessionId,
      metadata: { reason: "google_ads_api_recusou", detail: validation.detail },
    });
    return back("erro=google_ads_api_recusou");
  }

  const { data: existing } = await admin
    .from("google_ads_connections")
    .select("oauth_refresh_token_encrypted")
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!tokenResult.token.refreshToken && !existing?.oauth_refresh_token_encrypted) {
    await audit({
      action: "google_ads.conexao_falhou",
      organizationId,
      actorUserId: userId,
      actorAuthSessionId: state.authSessionId,
      metadata: { reason: "sem_token_de_renovacao" },
    });
    return back("erro=sem_token_de_renovacao");
  }

  const encryptedAccess = await encryptWebhookSecret(admin, tokenResult.token.accessToken);
  const encryptedRefresh = tokenResult.token.refreshToken
    ? await encryptWebhookSecret(admin, tokenResult.token.refreshToken)
    : null;
  if (!encryptedAccess || (tokenResult.token.refreshToken && !encryptedRefresh)) {
    return back("erro=cifra_indisponivel");
  }

  const values: Record<string, unknown> = {
    organization_id: organizationId,
    connected_by: userId,
    oauth_access_token_encrypted: encryptedAccess,
    token_expires_at: tokenResult.token.expiresAt,
    scopes: tokenResult.token.scopes,
    status: "healthy",
    last_error: null,
    last_validated_at: new Date().toISOString(),
  };
  if (encryptedRefresh) values.oauth_refresh_token_encrypted = encryptedRefresh;

  const { error: saveError } = await admin
    .from("google_ads_connections")
    .upsert(values, { onConflict: "organization_id" });
  if (saveError) {
    await audit({
      action: "google_ads.conexao_falhou",
      organizationId,
      actorUserId: userId,
      actorAuthSessionId: state.authSessionId,
      metadata: { reason: "nao_consegui_guardar", detail: saveError.message },
    });
    return back("erro=nao_consegui_guardar");
  }

  await audit({
    action: "google_ads.conexao_concluida",
    organizationId,
    actorUserId: userId,
    actorAuthSessionId: state.authSessionId,
    resourceType: "google_ads_connections",
    metadata: { accessible_customer_count: validation.customerIds.length },
  });

  return back("ok=1");
}
