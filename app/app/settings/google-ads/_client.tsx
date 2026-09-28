"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function GoogleAdsSettingsClient({
  connected,
  configured,
  initialClientId,
  redirectUri,
}: {
  connected: boolean;
  configured: boolean;
  initialClientId: string | null;
  redirectUri: string;
}) {
  const router = useRouter();
  const [clientId, setClientId] = useState(initialClientId ?? "");
  const [clientSecret, setClientSecret] = useState("");
  const [developerToken, setDeveloperToken] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(andConnect: boolean) {
    setBusy(true);
    try {
      const response = await fetch("/api/v1/ads/google/config", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          client_id: clientId.trim(),
          client_secret: clientSecret.trim(),
          developer_token: developerToken.trim() || undefined,
        }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          body?.error?.message ?? "Não consegui guardar a configuração do Google Ads.",
        );
      }

      setClientSecret("");
      setDeveloperToken("");
      toast.success(
        andConnect
          ? "Configuração salva. Abrindo o login do Google…"
          : "Configuração do Google Ads salva.",
      );

      if (andConnect) {
        window.location.assign("/api/v1/ads/google/connect");
        return;
      }
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não consegui guardar a configuração do Google Ads.",
      );
      setBusy(false);
    }
  }

  async function disconnect() {
    setBusy(true);
    try {
      const response = await fetch("/api/v1/ads/google/disconnect", { method: "POST" });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error?.message ?? "Não consegui desconectar o Google Ads.");
      }
      toast.success("Google Ads desconectado. O histórico coletado foi preservado.");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não consegui desconectar o Google Ads.",
      );
    } finally {
      setBusy(false);
    }
  }

  const canSave = clientId.trim().length >= 20 && (configured || clientSecret.trim().length > 0);

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        void save(true);
      }}
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="google_ads_client_id">OAuth Client ID</Label>
        <Input
          id="google_ads_client_id"
          value={clientId}
          autoComplete="off"
          onChange={(event) => setClientId(event.target.value)}
          placeholder="000000000000-xxxxxxxx.apps.googleusercontent.com"
        />
        <p className="text-xs text-muted-foreground">
          Client ID do projeto Google Cloud que será usado para o login do Google Ads.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="google_ads_client_secret">OAuth Client Secret</Label>
        <Input
          id="google_ads_client_secret"
          type="password"
          value={clientSecret}
          autoComplete="new-password"
          onChange={(event) => setClientSecret(event.target.value)}
          placeholder={configured ? "Guardado — deixe em branco para manter" : "Informe o Client Secret"}
        />
        <p className="text-xs text-muted-foreground">
          {configured
            ? "Já existe um segredo criptografado. Preencha somente para substituí-lo."
            : "O segredo é criptografado antes de ser armazenado e nunca volta para o navegador."}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="google_ads_redirect_uri">URI de redirecionamento</Label>
        <Input id="google_ads_redirect_uri" value={redirectUri} readOnly />
        <p className="text-xs text-muted-foreground">
          Cadastre exatamente esta URI no cliente OAuth do Google Cloud.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="google_ads_developer_token">Developer Token (opcional)</Label>
        <Input
          id="google_ads_developer_token"
          type="password"
          value={developerToken}
          autoComplete="off"
          onChange={(event) => setDeveloperToken(event.target.value)}
          placeholder="Opcional para compatibilidade com projetos antigos"
        />
        <p className="text-xs text-muted-foreground">
          A API atual associa o nível de acesso ao projeto Google Cloud. Use este campo somente se o seu projeto legado ainda utiliza o token.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={busy || !canSave}>
          {busy
            ? "Abrindo Google…"
            : configured
              ? connected
                ? "Salvar e reconectar com Google"
                : "Salvar e entrar com Google"
              : "Salvar e entrar com Google"}
        </Button>

        {configured && (
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => window.location.assign("/api/v1/ads/google/connect")}
          >
            {connected ? "Reconectar com Google" : "Entrar com Google"}
          </Button>
        )}

        {connected && (
          <Button type="button" variant="outline" disabled={busy} onClick={disconnect}>
            Desconectar
          </Button>
        )}
      </div>
    </form>
  );
}
