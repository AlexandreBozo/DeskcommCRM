import { describe, expect, it } from "vitest";

import type { GoogleAdsConfig } from "@/lib/plataformas-de-anuncio/google/config";
import {
  buildGoogleAdsConsentUrl,
  hasGoogleAdsScope,
} from "@/lib/plataformas-de-anuncio/google/oauth";

const CONFIG: GoogleAdsConfig = {
  clientId: "client-id",
  clientSecret: "client-secret",
  developerToken: "developer-token",
  redirectUri: "https://crm.example.com/api/v1/ads/google/callback",
};

describe("Google Ads OAuth", () => {
  it("gera consentimento offline com state e escopo adwords", () => {
    const url = new URL(
      buildGoogleAdsConsentUrl(CONFIG, {
        state: "state-123",
        loginHint: "operador@example.com",
      }),
    );

    expect(url.origin + url.pathname).toBe(
      "https://accounts.google.com/o/oauth2/v2/auth",
    );
    expect(url.searchParams.get("client_id")).toBe("client-id");
    expect(url.searchParams.get("redirect_uri")).toBe(CONFIG.redirectUri);
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("scope")).toBe(
      "https://www.googleapis.com/auth/adwords",
    );
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("prompt")).toBe("consent");
    expect(url.searchParams.get("state")).toBe("state-123");
    expect(url.searchParams.get("login_hint")).toBe("operador@example.com");
  });

  it("só aceita a autorização quando o scope adwords veio no token", () => {
    expect(
      hasGoogleAdsScope([
        "openid",
        "https://www.googleapis.com/auth/adwords",
      ]),
    ).toBe(true);

    expect(hasGoogleAdsScope(["openid", "email"])).toBe(false);
  });
});
