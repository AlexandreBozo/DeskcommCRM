import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { audit } from "@/lib/audit";
import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { requireSupportWrite } from "@/lib/impersonate/support";
import {
  googleAdsAppCredentialSummary,
  saveGoogleAdsAppCredentials,
} from "@/lib/plataformas-de-anuncio/google/credentials";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const schema = z.object({
  client_id: z.string().trim().min(20).max(512),
  client_secret: z.string().max(2048).optional().default(""),
  developer_token: z.string().max(512).optional(),
});

export async function GET(): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("admin", {
    requestId,
    resource: "google_ads_app_credentials",
  });
  if (!authz.ok) return authz.response;

  const summary = await googleAdsAppCredentialSummary(
    createAdminClient(),
    authz.org.orgId,
  );
  return ok(summary, { requestId });
}

export async function POST(req: NextRequest): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;

  const requestId = req.headers.get("x-request-id") ?? randomUUID();
  const authz = await requireRole("admin", {
    requestId,
    resource: "google_ads_app_credentials",
  });
  if (!authz.ok) return authz.response;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return fail("validation_failed", "Confira as credenciais do OAuth.", 422, {
      requestId,
      details: parsed.error.flatten(),
    });
  }

  const result = await saveGoogleAdsAppCredentials(
    createAdminClient(),
    authz.org.orgId,
    authz.user.id,
    {
      clientId: parsed.data.client_id,
      clientSecret: parsed.data.client_secret || undefined,
      developerToken: parsed.data.developer_token,
    },
  );

  if (!result.ok) {
    if (result.detail === "client_secret_required") {
      return fail(
        "google_ads_client_secret_required",
        "Informe o Client Secret na primeira configuração.",
        422,
        { requestId },
      );
    }
    return fail(
      "google_ads_config_save_failed",
      "Não consegui guardar a configuração do Google Ads.",
      500,
      { requestId, details: result.detail },
    );
  }

  await audit({
    action: "google_ads.configuracao_atualizada",
    organizationId: authz.org.orgId,
    actorUserId: authz.user.id,
    resourceType: "google_ads_app_credentials",
    requestId,
  });

  return ok({ saved: true }, { requestId });
}
