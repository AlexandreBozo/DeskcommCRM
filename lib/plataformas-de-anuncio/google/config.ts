import { env } from "@/lib/env";

export const GOOGLE_ADS_API_VERSION = "v25";
export const GOOGLE_ADS_SCOPE = "https://www.googleapis.com/auth/adwords";
export const GOOGLE_ADS_CALLBACK_PATH = "/api/v1/ads/google/callback";
export const GOOGLE_ADS_BIND_COOKIE = "crm_ads_oauth_bind";

export interface GoogleAdsConfig {
  clientId: string;
  clientSecret: string;
  developerToken: string | null;
  redirectUri: string;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function googleAdsRedirectUri(appUrl: string = env.NEXT_PUBLIC_APP_URL): string {
  return `${text(appUrl).replace(/\/+$/, "")}${GOOGLE_ADS_CALLBACK_PATH}`;
}

/**
 * Credenciais do APLICATIVO, não do tenant.
 *
 * GOOGLE_ADS_* é a fonte canônica. O fallback para o OAuth já usado pela Agenda
 * permite uma instalação reaproveitar o mesmo client do Google, desde que o novo
 * redirect URI esteja cadastrado no Google Cloud Console.
 */
export function googleAdsConfig(): GoogleAdsConfig | null {
  const clientId = text(env.GOOGLE_ADS_CLIENT_ID) || text(env.GOOGLE_CALENDAR_CLIENT_ID);
  const clientSecret =
    text(env.GOOGLE_ADS_CLIENT_SECRET) || text(env.GOOGLE_CALENDAR_CLIENT_SECRET);
  const developerToken = text(env.GOOGLE_ADS_DEVELOPER_TOKEN);

  if (!clientId || !clientSecret) return null;
  return {
    clientId,
    clientSecret,
    developerToken,
    redirectUri: googleAdsRedirectUri(),
  };
}

export function missingGoogleAdsConfig(): string[] {
  const missing: string[] = [];
  if (!(text(env.GOOGLE_ADS_CLIENT_ID) || text(env.GOOGLE_CALENDAR_CLIENT_ID))) {
    missing.push("GOOGLE_ADS_CLIENT_ID");
  }
  if (!(text(env.GOOGLE_ADS_CLIENT_SECRET) || text(env.GOOGLE_CALENDAR_CLIENT_SECRET))) {
    missing.push("GOOGLE_ADS_CLIENT_SECRET");
  }
  return missing;
}
