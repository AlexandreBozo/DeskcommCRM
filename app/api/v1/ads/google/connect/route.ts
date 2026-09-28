import { randomBytes } from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";

import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { emitirEstado } from "@/lib/agenda/google/estado";
import {
  assinarVinculo,
  VALIDADE_DO_VINCULO_S,
} from "@/lib/agenda/google/vinculo";
import { env } from "@/lib/env";
import { authenticatedSessionId, requireSupportWrite } from "@/lib/impersonate/support";
import {
  GOOGLE_ADS_BIND_COOKIE,
  GOOGLE_ADS_CALLBACK_PATH,
} from "@/lib/plataformas-de-anuncio/google/config";
import { readGoogleAdsAppConfig } from "@/lib/plataformas-de-anuncio/google/credentials";
import { buildGoogleAdsConsentUrl } from "@/lib/plataformas-de-anuncio/google/oauth";
import { createAdminClient } from "@/lib/supabase/admin";
import { cookieSecure } from "@/lib/supabase/cookie-secure";

export const dynamic = "force-dynamic";

function backWithError(code: string): NextResponse {
  return NextResponse.redirect(
    new URL(`/app/settings/google-ads?erro=${encodeURIComponent(code)}`, env.NEXT_PUBLIC_APP_URL),
  );
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;

  const requestId = req.headers.get("x-request-id") ?? undefined;
  const authz = await requireRole("admin", { requestId, resource: "google_ads_connections" });
  if (!authz.ok) return authz.response;
  const { user, org } = authz;

  const config = await readGoogleAdsAppConfig(createAdminClient(), org.orgId);
  if (!config) return backWithError("google_ads_nao_configurado");

  const nonce = randomBytes(16).toString("base64url");
  let state: string;
  try {
    state = emitirEstado(
      {
        organizationId: org.orgId,
        userId: user.id,
        authSessionId: await authenticatedSessionId(),
      },
      { segredo: env.INTERNAL_SECRET, agora: new Date(), nonce },
    );
  } catch {
    await audit({
      action: "google_ads.conexao_falhou",
      organizationId: org.orgId,
      actorUserId: user.id,
      metadata: { reason: "segredo_de_state_indisponivel" },
    });
    return backWithError("segredo_indisponivel");
  }

  const consentUrl = buildGoogleAdsConsentUrl(config, {
    state,
    loginHint: user.email,
  });

  await audit({
    action: "google_ads.conexao_iniciada",
    organizationId: org.orgId,
    actorUserId: user.id,
  });

  const response = NextResponse.redirect(consentUrl);
  response.cookies.set(GOOGLE_ADS_BIND_COOKIE, assinarVinculo(nonce, env.INTERNAL_SECRET), {
    httpOnly: true,
    sameSite: "lax",
    secure: cookieSecure(),
    path: GOOGLE_ADS_CALLBACK_PATH,
    maxAge: VALIDADE_DO_VINCULO_S,
  });
  return response;
}
