import {
  GOOGLE_ADS_SCOPE,
  type GoogleAdsConfig,
} from "./config";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

export interface GoogleAdsOAuthToken {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string;
  scopes: string[];
}

export type GoogleAdsOAuthResult =
  | { ok: true; token: GoogleAdsOAuthToken }
  | { ok: false; detail: string };

export function buildGoogleAdsConsentUrl(
  config: GoogleAdsConfig,
  options: { state: string; loginHint?: string | null },
): string {
  const query = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: GOOGLE_ADS_SCOPE,
    access_type: "offline",
    prompt: "consent",
    state: options.state,
  });
  if (options.loginHint?.trim()) query.set("login_hint", options.loginHint.trim());
  return `${AUTH_URL}?${query.toString()}`;
}

function parseToken(body: unknown, now: Date): GoogleAdsOAuthResult {
  if (!body || typeof body !== "object") {
    return { ok: false, detail: "resposta de token inválida" };
  }
  const raw = body as Record<string, unknown>;
  if (typeof raw.error === "string") {
    const description =
      typeof raw.error_description === "string" ? `: ${raw.error_description}` : "";
    return { ok: false, detail: `${raw.error}${description}` };
  }
  if (typeof raw.access_token !== "string" || !raw.access_token.trim()) {
    return { ok: false, detail: "resposta sem access_token" };
  }
  const expiresIn = Number(raw.expires_in);
  const expiresAt = new Date(
    now.getTime() + (Number.isFinite(expiresIn) ? expiresIn * 1000 : 0),
  ).toISOString();
  const scopes =
    typeof raw.scope === "string" ? raw.scope.split(/\s+/).filter(Boolean) : [];

  return {
    ok: true,
    token: {
      accessToken: raw.access_token,
      refreshToken:
        typeof raw.refresh_token === "string" && raw.refresh_token.trim()
          ? raw.refresh_token
          : null,
      expiresAt,
      scopes,
    },
  };
}

async function tokenRequest(
  params: URLSearchParams,
  now: Date,
): Promise<GoogleAdsOAuthResult> {
  let response: Response;
  try {
    response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: params,
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    return {
      ok: false,
      detail: error instanceof Error ? error.message : "falha de rede no OAuth",
    };
  }

  const body = await response.json().catch(() => null);
  const parsed = parseToken(body, now);
  if (!response.ok && parsed.ok) {
    return { ok: false, detail: `OAuth HTTP ${response.status}` };
  }
  return parsed;
}

export function exchangeGoogleAdsCode(
  config: GoogleAdsConfig,
  code: string,
  now: Date = new Date(),
): Promise<GoogleAdsOAuthResult> {
  return tokenRequest(
    new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: "authorization_code",
    }),
    now,
  );
}

export function refreshGoogleAdsToken(
  config: GoogleAdsConfig,
  refreshToken: string,
  now: Date = new Date(),
): Promise<GoogleAdsOAuthResult> {
  return tokenRequest(
    new URLSearchParams({
      refresh_token: refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: "refresh_token",
    }),
    now,
  );
}

export function hasGoogleAdsScope(scopes: string[]): boolean {
  return scopes.includes(GOOGLE_ADS_SCOPE);
}
