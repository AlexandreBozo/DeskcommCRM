import { readFileSync } from "node:fs";
import path from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { saveGoogleAdsAppCredentials } from "@/lib/plataformas-de-anuncio/google/credentials";
import { encryptWebhookSecret } from "@/lib/webhooks/secrets";

vi.mock("@/lib/env", () => ({
  env: {
    GOOGLE_ADS_CLIENT_ID: "",
    GOOGLE_ADS_CLIENT_SECRET: "",
    GOOGLE_ADS_DEVELOPER_TOKEN: "",
    GOOGLE_CALENDAR_CLIENT_ID: "",
    GOOGLE_CALENDAR_CLIENT_SECRET: "",
    NEXT_PUBLIC_APP_URL: "https://crm.example.com",
  },
}));

vi.mock("@/lib/webhooks/secrets", () => ({
  encryptWebhookSecret: vi.fn(),
  decryptWebhookSecret: vi.fn(),
}));

interface DatabaseState {
  existing: {
    oauth_client_secret_encrypted: string | null;
    developer_token_encrypted: string | null;
  } | null;
  lookupError: { message: string } | null;
  upsertError: { message: string } | null;
}

const state: DatabaseState = {
  existing: null,
  lookupError: null,
  upsertError: null,
};
const upserts: Record<string, unknown>[] = [];

function admin() {
  return {
    from: (table: string) => {
      expect(table).toBe("google_ads_app_credentials");
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: state.existing, error: state.lookupError }),
          }),
        }),
        upsert: async (values: Record<string, unknown>) => {
          upserts.push(values);
          return { error: state.upsertError };
        },
      };
    },
  } as never;
}

beforeEach(() => {
  state.existing = null;
  state.lookupError = null;
  state.upsertError = null;
  upserts.length = 0;
  vi.mocked(encryptWebhookSecret).mockReset();
});

describe("saveGoogleAdsAppCredentials", () => {
  it("distingue segredo realmente ausente na primeira configuração", async () => {
    const result = await saveGoogleAdsAppCredentials(admin(), "org-1", "user-1", {
      clientId: "client-id-with-enough-characters.apps.googleusercontent.com",
    });

    expect(result).toEqual({ ok: false, detail: "client_secret_required" });
    expect(encryptWebhookSecret).not.toHaveBeenCalled();
    expect(upserts).toHaveLength(0);
  });

  it("distingue segredo informado cuja criptografia falhou", async () => {
    vi.mocked(encryptWebhookSecret).mockResolvedValue(null);

    const result = await saveGoogleAdsAppCredentials(admin(), "org-1", "user-1", {
      clientId: "client-id-with-enough-characters.apps.googleusercontent.com",
      clientSecret: "secret-present",
    });

    expect(result).toEqual({ ok: false, detail: "cipher_unavailable" });
    expect(encryptWebhookSecret).toHaveBeenCalledWith(expect.anything(), "secret-present");
    expect(upserts).toHaveLength(0);
  });

  it("distingue falha ao ler ou persistir a configuração", async () => {
    state.lookupError = { message: "relation unavailable" };

    const lookupResult = await saveGoogleAdsAppCredentials(admin(), "org-1", "user-1", {
      clientId: "client-id-with-enough-characters.apps.googleusercontent.com",
      clientSecret: "secret-present",
    });
    expect(lookupResult).toEqual({ ok: false, detail: "persistence_failed" });
    expect(encryptWebhookSecret).not.toHaveBeenCalled();

    state.lookupError = null;
    state.upsertError = { message: "write failed" };
    vi.mocked(encryptWebhookSecret).mockResolvedValue("\\xciphertext");

    const saveResult = await saveGoogleAdsAppCredentials(admin(), "org-1", "user-1", {
      clientId: "client-id-with-enough-characters.apps.googleusercontent.com",
      clientSecret: "secret-present",
    });
    expect(saveResult).toEqual({ ok: false, detail: "persistence_failed" });
  });

  it("persiste somente a cifra e preserva o segredo existente quando o campo fica vazio", async () => {
    vi.mocked(encryptWebhookSecret).mockResolvedValue("\\xciphertext");

    const created = await saveGoogleAdsAppCredentials(admin(), "org-1", "user-1", {
      clientId: " client-id-with-enough-characters.apps.googleusercontent.com ",
      clientSecret: " secret-present ",
    });
    expect(created).toEqual({ ok: true });
    expect(upserts[0]).toMatchObject({
      organization_id: "org-1",
      configured_by: "user-1",
      oauth_client_id: "client-id-with-enough-characters.apps.googleusercontent.com",
      oauth_client_secret_encrypted: "\\xciphertext",
    });
    expect(JSON.stringify(upserts[0])).not.toContain("secret-present");

    state.existing = {
      oauth_client_secret_encrypted: "\\xexisting",
      developer_token_encrypted: null,
    };
    upserts.length = 0;
    vi.mocked(encryptWebhookSecret).mockReset();

    const updated = await saveGoogleAdsAppCredentials(admin(), "org-1", "user-1", {
      clientId: "client-id-with-enough-characters.apps.googleusercontent.com",
      clientSecret: "",
    });
    expect(updated).toEqual({ ok: true });
    expect(upserts[0]?.oauth_client_secret_encrypted).toBe("\\xexisting");
    expect(encryptWebhookSecret).not.toHaveBeenCalled();
  });
});

describe("migration Google Ads canônica", () => {
  it("inclui cifra, fundação operacional e nunca contém a chave mestra", () => {
    const migration = readFileSync(
      path.join(
        process.cwd(),
        "supabase/migrations/20260928220000_0239_google_ads_operational_foundation.sql",
      ),
      "utf8",
    );

    for (const object of [
      "private.app_secrets",
      "private.fn_oauth_key",
      "public.fn_encrypt_oauth",
      "public.fn_decrypt_oauth",
      "public.google_ads_app_credentials",
      "public.google_ads_connections",
      "public.google_ads_oauth_nonces",
      "public.ad_accounts",
      "public.ad_campaigns",
      "public.ad_metrics_daily",
      "public.ad_sync_runs",
    ]) {
      expect(migration).toContain(object);
    }
    expect(migration).not.toMatch(/values\s*\(\s*['"]nuvemshop_oauth_key['"]\s*,/i);
    expect(migration).not.toContain("oauth_client_secret text");
    expect(migration).not.toContain("oauth_access_token text");
    expect(migration).not.toContain("oauth_refresh_token text");
  });
});
