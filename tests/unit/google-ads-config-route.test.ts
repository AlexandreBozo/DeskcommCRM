import { beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/v1/ads/google/config/route";
import { saveGoogleAdsAppCredentials } from "@/lib/plataformas-de-anuncio/google/credentials";

vi.mock("@/lib/audit", () => ({ audit: vi.fn(async () => undefined) }));
vi.mock("@/lib/auth/require-role", () => ({
  requireRole: vi.fn(async () => ({
    ok: true,
    user: { id: "user-1" },
    org: { orgId: "org-1" },
  })),
}));
vi.mock("@/lib/impersonate/support", () => ({
  requireSupportWrite: vi.fn(async () => null),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({})),
}));
vi.mock("@/lib/plataformas-de-anuncio/google/credentials", () => ({
  googleAdsAppCredentialSummary: vi.fn(),
  saveGoogleAdsAppCredentials: vi.fn(),
}));

function request() {
  return new Request("https://crm.example.com/api/v1/ads/google/config", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      client_id: "client-id-with-enough-characters.apps.googleusercontent.com",
      client_secret: "secret-present",
    }),
  }) as never;
}

beforeEach(() => {
  vi.mocked(saveGoogleAdsAppCredentials).mockReset();
});

describe("POST /api/v1/ads/google/config", () => {
  it("mantém 422 somente para segredo realmente ausente", async () => {
    vi.mocked(saveGoogleAdsAppCredentials).mockResolvedValue({
      ok: false,
      detail: "client_secret_required",
    });

    const response = await POST(request());
    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "google_ads_client_secret_required",
        message: "Informe o Client Secret na primeira configuração.",
      },
    });
  });

  it("retorna erro operacional específico quando a cifra está indisponível", async () => {
    vi.mocked(saveGoogleAdsAppCredentials).mockResolvedValue({
      ok: false,
      detail: "cipher_unavailable",
    });

    const response = await POST(request());
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: "google_ads_cipher_unavailable",
        message:
          "Não foi possível criptografar o Client Secret. Verifique a configuração da chave mestra de criptografia do servidor.",
      },
    });
  });

  it("retorna persistência sem expor o erro interno do banco", async () => {
    vi.mocked(saveGoogleAdsAppCredentials).mockResolvedValue({
      ok: false,
      detail: "persistence_failed",
    });

    const response = await POST(request());
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toMatchObject({
      error: {
        code: "google_ads_config_persistence_failed",
        message: "Não foi possível guardar a configuração do Google Ads.",
      },
    });
    expect(body.error).not.toHaveProperty("details");
    expect(JSON.stringify(body)).not.toContain("relation unavailable");
    expect(JSON.stringify(body)).not.toContain("write failed");
  });
});
