import type { SupabaseClient } from "@supabase/supabase-js";

import { decryptWebhookSecret, encryptWebhookSecret } from "@/lib/webhooks/secrets";
import { readGoogleAdsAppConfig } from "./credentials";
import { refreshGoogleAdsToken } from "./oauth";

const REFRESH_MARGIN_MS = 5 * 60 * 1000;

interface GoogleAdsConnectionRow {
  oauth_access_token_encrypted: string | null;
  oauth_refresh_token_encrypted: string | null;
  token_expires_at: string | null;
  scopes: string[] | null;
  default_customer_id: string | null;
  login_customer_id: string | null;
  status: string;
}

export type GoogleAdsConnectionState =
  | {
      ok: true;
      accessToken: string;
      defaultCustomerId: string | null;
      loginCustomerId: string | null;
      scopes: string[];
    }
  | {
      ok: false;
      reason: "not_configured" | "not_connected" | "decrypt_failed" | "needs_reauth";
      detail?: string;
    };

export async function googleAdsConnectionSummary(
  admin: SupabaseClient,
  organizationId: string,
): Promise<{
  connected: boolean;
  status: string | null;
  defaultCustomerId: string | null;
  loginCustomerId: string | null;
}> {
  const { data, error } = await admin
    .from("google_ads_connections")
    .select("status,default_customer_id,login_customer_id")
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error || !data) {
    return { connected: false, status: null, defaultCustomerId: null, loginCustomerId: null };
  }
  const row = data as {
    status: string | null;
    default_customer_id: string | null;
    login_customer_id: string | null;
  };
  return {
    connected: true,
    status: row.status,
    defaultCustomerId: row.default_customer_id,
    loginCustomerId: row.login_customer_id,
  };
}

export async function readGoogleAdsConnection(
  admin: SupabaseClient,
  organizationId: string,
): Promise<GoogleAdsConnectionState> {
  const config = await readGoogleAdsAppConfig(admin, organizationId);
  if (!config) return { ok: false, reason: "not_configured" };

  const { data, error } = await admin
    .from("google_ads_connections")
    .select(
      "oauth_access_token_encrypted,oauth_refresh_token_encrypted,token_expires_at,scopes,default_customer_id,login_customer_id,status",
    )
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error || !data) return { ok: false, reason: "not_connected" };

  const row = data as GoogleAdsConnectionRow;
  if (!row.oauth_access_token_encrypted || !row.oauth_refresh_token_encrypted) {
    return { ok: false, reason: "needs_reauth" };
  }

  let accessToken = await decryptWebhookSecret(admin, row.oauth_access_token_encrypted);
  const refreshToken = await decryptWebhookSecret(admin, row.oauth_refresh_token_encrypted);
  if (!accessToken || !refreshToken) return { ok: false, reason: "decrypt_failed" };

  const expiresAt = row.token_expires_at ? new Date(row.token_expires_at).getTime() : 0;
  if (!expiresAt || expiresAt - Date.now() <= REFRESH_MARGIN_MS) {
    const refreshed = await refreshGoogleAdsToken(config, refreshToken);
    if (!refreshed.ok) {
      await admin
        .from("google_ads_connections")
        .update({ status: "needs_reauth", last_error: refreshed.detail })
        .eq("organization_id", organizationId);
      return { ok: false, reason: "needs_reauth", detail: refreshed.detail };
    }

    accessToken = refreshed.token.accessToken;
    const encrypted = await encryptWebhookSecret(admin, accessToken);
    if (!encrypted) return { ok: false, reason: "decrypt_failed" };

    await admin
      .from("google_ads_connections")
      .update({
        oauth_access_token_encrypted: encrypted,
        token_expires_at: refreshed.token.expiresAt,
        scopes: refreshed.token.scopes.length > 0 ? refreshed.token.scopes : (row.scopes ?? []),
        status: "healthy",
        last_error: null,
        last_validated_at: new Date().toISOString(),
      })
      .eq("organization_id", organizationId);
  }

  return {
    ok: true,
    accessToken,
    defaultCustomerId: row.default_customer_id,
    loginCustomerId: row.login_customer_id,
    scopes: row.scopes ?? [],
  };
}
