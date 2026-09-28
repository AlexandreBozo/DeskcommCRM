"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useGoogleAdsAccounts, useGoogleAdsCampaigns } from "@/hooks/ads/useGoogleAds";
import { ApiError } from "@/lib/api/types";

const CUSTOM = "custom";

function dateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function yesterday(): Date {
  return new Date(Date.now() - 24 * 60 * 60 * 1000);
}

function period(days: number): { from: string; to: string } {
  const end = yesterday();
  const start = new Date(end.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
  return { from: dateOnly(start), to: dateOnly(end) };
}

function number(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined) return "—";
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function money(value: number | null | undefined, currency: string): string {
  if (value === null || value === undefined) return "—";
  return value.toLocaleString("pt-BR", { style: "currency", currency });
}

function percent(value: number | null | undefined): string {
  return value === null || value === undefined ? "—" : `${number(value, 2)}%`;
}

function multiple(value: number | null | undefined): string {
  return value === null || value === undefined ? "—" : `${number(value, 2)}x`;
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === "google_ads_not_connected") return "Google Ads ainda não está conectado.";
    if (error.code === "google_ads_not_configured") return "A instalação ainda não está configurada para Google Ads.";
    if (error.code === "google_ads_upstream_error") return "O Google Ads recusou ou não concluiu a consulta. Confira a conexão e tente novamente.";
    return error.message;
  }
  return "Não consegui carregar os dados do Google Ads agora.";
}

export function GoogleAdsClient({ defaultCustomerId }: { defaultCustomerId: string | null }) {
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(defaultCustomerId);
  const [preset, setPreset] = useState("7");
  const [range, setRange] = useState(() => period(7));

  const accountsQuery = useGoogleAdsAccounts(true);
  const accounts = useMemo(() => accountsQuery.data?.data.accounts ?? [], [accountsQuery.data]);
  const effectiveCustomer = useMemo(() => {
    if (selectedCustomer && accounts.some((account) => account.customerId === selectedCustomer && !account.isManager)) {
      return selectedCustomer;
    }
    if (defaultCustomerId && accounts.some((account) => account.customerId === defaultCustomerId && !account.isManager)) {
      return defaultCustomerId;
    }
    return accounts.find((account) => !account.isManager)?.customerId ?? null;
  }, [accounts, defaultCustomerId, selectedCustomer]);

  const currentAccount = accounts.find((account) => account.customerId === effectiveCustomer) ?? null;
  const currency = currentAccount?.currency ?? "BRL";
  const campaignsQuery = useGoogleAdsCampaigns({
    customerId: effectiveCustomer,
    from: range.from,
    to: range.to,
  });
  const data = campaignsQuery.data?.data;

  function changePreset(value: string) {
    setPreset(value);
    if (value !== CUSTOM) setRange(period(Number(value)));
  }

  const loading = accountsQuery.isLoading || campaignsQuery.isFetching;
  const error = accountsQuery.error ?? campaignsQuery.error;

  const kpis = data
    ? [
        ["Investimento", money(data.summary.spend, currency)],
        ["Impressões", number(data.summary.impressions)],
        ["Cliques", number(data.summary.clicks)],
        ["CTR", percent(data.summary.ctr)],
        ["CPC", money(data.summary.cpc, currency)],
        ["Conversões", number(data.summary.conversions, 2)],
        ["Custo / conversão", money(data.summary.costPerConversion, currency)],
        ["Valor de conversão", money(data.summary.conversionValue, currency)],
        ["ROAS", multiple(data.summary.roas)],
      ]
    : [];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="google-ads-account">Conta</Label>
          <Select value={effectiveCustomer ?? ""} onValueChange={setSelectedCustomer} disabled={accounts.length === 0}>
            <SelectTrigger id="google-ads-account" className="w-80">
              <SelectValue placeholder="Carregando contas…" />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((account) => (
                <SelectItem key={`${account.loginCustomerId ?? "root"}:${account.customerId}`} value={account.customerId} disabled={account.isManager}>
                  {account.name} · {account.customerId}{account.isManager ? " · MCC" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="google-ads-period">Período</Label>
          <Select value={preset} onValueChange={changePreset}>
            <SelectTrigger id="google-ads-period" className="w-52"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="14">Últimos 14 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
              <SelectItem value={CUSTOM}>Personalizado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {preset === CUSTOM && (
          <>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="google-ads-from">De</Label>
              <Input id="google-ads-from" type="date" className="w-40" value={range.from} max={range.to} onChange={(event) => setRange((current) => ({ ...current, from: event.target.value }))} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="google-ads-to">Até</Label>
              <Input id="google-ads-to" type="date" className="w-40" value={range.to} min={range.from} max={dateOnly(yesterday())} onChange={(event) => setRange((current) => ({ ...current, to: event.target.value }))} />
            </div>
          </>
        )}

        <Button disabled={loading || !effectiveCustomer} onClick={() => campaignsQuery.refetch()}>
          {loading ? "Atualizando…" : "Atualizar"}
        </Button>
      </div>

      {error && (
        <div role="alert" className="rounded-md border border-red-500/40 bg-red-500/10 p-4 text-sm">
          <p className="font-medium">{errorMessage(error)}</p>
          {error instanceof ApiError && <p className="mt-1 text-xs text-muted-foreground">Código: {error.code} · Requisição: {error.requestId}</p>}
        </div>
      )}

      {data && !error && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
            {kpis.map(([label, value]) => (
              <Card key={label} className="p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
                <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
              </Card>
            ))}
          </div>

          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-text">{data.campaigns.length}</span>{" "}
            {data.campaigns.length === 1 ? "campanha carregada" : "campanhas carregadas"} nesta conta. Todas as campanhas retornadas pelo Google Ads no período são exibidas separadamente abaixo.
          </p>

          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 z-10 min-w-64 bg-bg">Campanha</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Investimento</TableHead>
                  <TableHead className="text-right">Impressões</TableHead>
                  <TableHead className="text-right">Cliques</TableHead>
                  <TableHead className="text-right">CTR</TableHead>
                  <TableHead className="text-right">CPC</TableHead>
                  <TableHead className="text-right">CPM</TableHead>
                  <TableHead className="text-right">Conversões</TableHead>
                  <TableHead className="text-right">Custo / conv.</TableHead>
                  <TableHead className="text-right">Valor conv.</TableHead>
                  <TableHead className="text-right">ROAS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.campaigns.map((campaign) => (
                  <TableRow key={campaign.campaignId}>
                    <TableCell className="sticky left-0 z-10 max-w-80 bg-bg font-medium">
                      <span className="block truncate" title={campaign.name}>{campaign.name}</span>
                    </TableCell>
                    <TableCell>{campaign.status ?? "—"}</TableCell>
                    <TableCell>{campaign.channelType ?? "—"}</TableCell>
                    <TableCell className="text-right">{money(campaign.spend, currency)}</TableCell>
                    <TableCell className="text-right">{number(campaign.impressions)}</TableCell>
                    <TableCell className="text-right">{number(campaign.clicks)}</TableCell>
                    <TableCell className="text-right">{percent(campaign.ctr)}</TableCell>
                    <TableCell className="text-right">{money(campaign.cpc, currency)}</TableCell>
                    <TableCell className="text-right">{money(campaign.cpm, currency)}</TableCell>
                    <TableCell className="text-right">{number(campaign.conversions, 2)}</TableCell>
                    <TableCell className="text-right">{money(campaign.costPerConversion, currency)}</TableCell>
                    <TableCell className="text-right">{money(campaign.conversionValue, currency)}</TableCell>
                    <TableCell className="text-right">{multiple(campaign.roas)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {data.campaigns.length === 0 && (
            <p className="rounded-md border p-4 text-sm text-muted-foreground">Nenhuma campanha com dados no período selecionado.</p>
          )}

          <p className="text-xs text-muted-foreground">
            Período: {data.period.from} a {data.period.to} · lido em {new Date(data.read_at).toLocaleString("pt-BR")}. Cada leitura concluída atualiza o histórico diário do Coagentica.
          </p>
        </>
      )}

      {accountsQuery.isLoading && !error && <p className="text-sm text-muted-foreground">Descobrindo contas do Google Ads…</p>}
    </div>
  );
}
