import type { SupabaseClient } from "@supabase/supabase-js";

import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { decryptWebhookSecret, encryptWebhookSecret } from "@/lib/webhooks/secrets";

import { googleAdsRedirectUri, type GoogleAdsConfig } from "./config";

interface GoogleAdsAppCredentialRow {
  oauth_client_id: string;
  oauth_client_secret_encrypted: string;
  developer_token_encrypted: string | null;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function envConfig(): GoogleAdsConfig | null {
  const clientId = text(env.GOOGLE_ADS_CLIENT_ID) || text(env.GOOGLE_CALENDAR_CLIENT_ID);
  const clientSecret =
    text(env.GOOGLE_ADS_CLIENT_SECRET) || text(env.GOOGLE_CALENDAR_CLIENT_SECRET);
  if (!clientId || !clientSecret) return null;

  return {
    clientId,
    clientSecret,
    developerToken: text(env.GOOGLE_ADS_DEVELOPER_TOKEN) || null,
    redirectUri: googleAdsRedirectUri(),
  };
}

export async function googleAdsAppCredentialSummary(
  admin: SupabaseClient,
  organizationId: string,
): Promise<{
  configured: boolean;
  clientId: string | null;
  source: "organization" | "installation" | null;
}> {
  const { data } = await admin
    .from("google_ads_app_credentials")
    .select("oauth_client_id")
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (data?.oauth_client_id) {
    return {
      configured: true,
      clientId: String(data.oauth_client_id),
      source: "organization",
    };
  }

  const fallback = envConfig();
  return {
    configured: Boolean(fallback),
    clientId: fallback?.clientId ?? null,
    source: fallback ? "installation" : null,
  };
}

export async function readGoogleAdsAppConfig(
  admin: SupabaseClient,
  organizationId: string,
): Promise<GoogleAdsConfig | null> {
  const { data, error } = await admin
    .from("google_ads_app_credentials")
    .select("oauth_client_id,oauth_client_secret_encrypted,developer_token_encrypted")
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (!error && data) {
    const row = data as GoogleAdsAppCredentialRow;
    const clientSecret = await decryptWebhookSecret(admin, row.oauth_client_secret_encrypted);
    const developerToken = row.developer_token_encrypted
      ? await decryptWebhookSecret(admin, row.developer_token_encrypted)
      : null;

    if (!clientSecret) return null;
    return {
      clientId: row.oauth_client_id,
      clientSecret,
      developerToken: developerToken || null,
      redirectUri: googleAdsRedirectUri(),
    };
  }

  return envConfig();
}

type GoogleAdsCredentialSaveFailure =
  "client_secret_required" | "cipher_unavailable" | "persistence_failed";

export async function saveGoogleAdsAppCredentials(
  admin: SupabaseClient,
  organizationId: string,
  userId: string,
  input: {
    clientId: string;
    clientSecret?: string | null;
    developerToken?: string | null;
  },
): Promise<{ ok: true } | { ok: false; detail: GoogleAdsCredentialSaveFailure }> {
  const { data: existing, error: lookupError } = await admin
    .from("google_ads_app_credentials")
    .select("oauth_client_secret_encrypted,developer_token_encrypted")
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (lookupError) {
    logger.warn("[google-ads.credentials] leitura da configuração falhou", {
      organizationId,
      error: lookupError.message,
    });
    return { ok: false, detail: "persistence_failed" };
  }

  const providedClientSecret = input.clientSecret?.trim() ?? "";
  let clientSecretEncrypted =
    (existing?.oauth_client_secret_encrypted as string | null | undefined) ?? null;
  if (providedClientSecret) {
    clientSecretEncrypted = await encryptWebhookSecret(admin, providedClientSecret);
    if (!clientSecretEncrypted) {
      return { ok: false, detail: "cipher_unavailable" };
    }
  } else if (!clientSecretEncrypted) {
    return { ok: false, detail: "client_secret_required" };
  }

  let developerTokenEncrypted =
    (existing?.developer_token_encrypted as string | null | undefined) ?? null;
  if (input.developerToken !== undefined) {
    developerTokenEncrypted = input.developerToken?.trim()
      ? await encryptWebhookSecret(admin, input.developerToken.trim())
      : null;
    if (input.developerToken?.trim() && !developerTokenEncrypted) {
      return { ok: false, detail: "cipher_unavailable" };
    }
  }

  const { error } = await admin.from("google_ads_app_credentials").upsert(
    {
      organization_id: organizationId,
      configured_by: userId,
      oauth_client_id: input.clientId.trim(),
      oauth_client_secret_encrypted: clientSecretEncrypted,
      developer_token_encrypted: developerTokenEncrypted,
    },
    { onConflict: "organization_id" },
  );

  if (error) {
    logger.warn("[google-ads.credentials] persistência da configuração falhou", {
      organizationId,
      error: error.message,
    });
    return { ok: false, detail: "persistence_failed" };
  }
  return { ok: true };
}
