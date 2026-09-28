import type { SupabaseClient } from "@supabase/supabase-js";

import {
  getGoogleAdsCampaignDays,
  getGoogleAdsCustomer,
  listAccessibleGoogleAdsCustomers,
  listGoogleAdsManagerChildren,
  sessionFromConfig,
  type GoogleAdsAccount,
  type GoogleAdsCampaignDay,
} from "./client";
import { readGoogleAdsAppConfig } from "./credentials";
import { readGoogleAdsConnection } from "./connection";

export interface GoogleAdsCampaignLine {
  campaignId: string;
  name: string;
  status: string | null;
  channelType: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  interactions: number;
  conversions: number;
  conversionValue: number;
  viewThroughConversions: number;
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  costPerConversion: number | null;
  roas: number | null;
}

export interface GoogleAdsSummary {
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  conversionValue: number;
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  costPerConversion: number | null;
  roas: number | null;
}

function ratio(numerator: number, denominator: number, multiplier = 1): number | null {
  if (!denominator) return null;
  return (numerator / denominator) * multiplier;
}

function moneyFromMicros(micros: number | null): number {
  return (micros ?? 0) / 1_000_000;
}

async function persistAccounts(
  admin: SupabaseClient,
  organizationId: string,
  accounts: GoogleAdsAccount[],
): Promise<void> {
  if (accounts.length === 0) return;
  const now = new Date().toISOString();
  const { error } = await admin.from("ad_accounts").upsert(
    accounts.map((account) => ({
      organization_id: organizationId,
      platform: "google_ads",
      external_account_id: account.customerId,
      parent_external_account_id: account.parentCustomerId,
      name: account.name,
      currency: account.currency,
      time_zone: account.timeZone,
      status: account.status,
      is_manager: account.isManager,
      metadata: { login_customer_id: account.loginCustomerId },
      last_seen_at: now,
    })),
    { onConflict: "organization_id,platform,external_account_id" },
  );
  if (error) throw new Error(`ad_accounts: ${error.message}`);
}

export async function discoverGoogleAdsAccounts(
  admin: SupabaseClient,
  organizationId: string,
): Promise<{ ok: true; accounts: GoogleAdsAccount[] } | { ok: false; detail: string }> {
  const config = await readGoogleAdsAppConfig(admin, organizationId);
  if (!config) return { ok: false, detail: "Google Ads não configurado na instalação" };
  const connection = await readGoogleAdsConnection(admin, organizationId);
  if (!connection.ok) return { ok: false, detail: connection.reason };

  const baseSession = sessionFromConfig(config, connection.accessToken);
  const accessible = await listAccessibleGoogleAdsCustomers(baseSession);
  if (!accessible.ok) return accessible;

  const byId = new Map<string, GoogleAdsAccount>();
  for (const customerId of accessible.customerIds) {
    const detail = await getGoogleAdsCustomer(customerId, baseSession);
    if (!detail.ok) continue;
    byId.set(detail.account.customerId, detail.account);

    if (detail.account.isManager) {
      const children = await listGoogleAdsManagerChildren(customerId, baseSession);
      if (children.ok) {
        for (const child of children.accounts) byId.set(child.customerId, child);
      }
    }
  }

  const accounts = [...byId.values()].sort((a, b) => {
    if (a.isManager !== b.isManager) return a.isManager ? 1 : -1;
    return a.name.localeCompare(b.name);
  });
  try {
    await persistAccounts(admin, organizationId, accounts);
  } catch (error) {
    return {
      ok: false,
      detail: error instanceof Error ? error.message : "falha ao persistir contas do Google Ads",
    };
  }

  const defaultCustomer =
    connection.defaultCustomerId ??
    accounts.find((account) => !account.isManager)?.customerId ??
    accounts[0]?.customerId ??
    null;

  if (defaultCustomer && defaultCustomer !== connection.defaultCustomerId) {
    const selected = accounts.find((account) => account.customerId === defaultCustomer);
    const { error } = await admin
      .from("google_ads_connections")
      .update({
        default_customer_id: defaultCustomer,
        login_customer_id: selected?.loginCustomerId ?? null,
        last_validated_at: new Date().toISOString(),
      })
      .eq("organization_id", organizationId);
    if (error) return { ok: false, detail: `google_ads_connections: ${error.message}` };
  }

  return { ok: true, accounts };
}

async function persistCampaignDays(
  admin: SupabaseClient,
  organizationId: string,
  account: GoogleAdsAccount,
  rows: GoogleAdsCampaignDay[],
): Promise<void> {
  if (rows.length === 0) return;
  const campaignMap = new Map<string, GoogleAdsCampaignDay>();
  for (const row of rows) campaignMap.set(row.campaignId, row);
  const now = new Date().toISOString();

  const { error: campaignsError } = await admin.from("ad_campaigns").upsert(
    [...campaignMap.values()].map((row) => ({
      organization_id: organizationId,
      platform: "google_ads",
      external_account_id: account.customerId,
      external_campaign_id: row.campaignId,
      name: row.campaignName,
      status: row.status,
      campaign_type: row.channelType,
      start_date: row.startDate,
      end_date: row.endDate,
      last_seen_at: now,
    })),
    { onConflict: "organization_id,platform,external_account_id,external_campaign_id" },
  );
  if (campaignsError) throw new Error(`ad_campaigns: ${campaignsError.message}`);

  const { error: metricsError } = await admin.from("ad_metrics_daily").upsert(
    rows.map((row) => ({
      organization_id: organizationId,
      platform: "google_ads",
      external_account_id: account.customerId,
      external_campaign_id: row.campaignId,
      metric_date: row.date,
      currency: account.currency,
      cost_micros: row.costMicros,
      impressions: row.impressions,
      clicks: row.clicks,
      interactions: row.interactions,
      conversions: row.conversions,
      all_conversions: row.allConversions,
      conversion_value: row.conversionValue,
      all_conversion_value: row.allConversionValue,
      view_through_conversions: row.viewThroughConversions,
      raw: {},
      collected_at: now,
    })),
    { onConflict: "organization_id,platform,external_account_id,external_campaign_id,metric_date" },
  );
  if (metricsError) throw new Error(`ad_metrics_daily: ${metricsError.message}`);
}

export async function syncGoogleAdsCampaigns(
  admin: SupabaseClient,
  organizationId: string,
  customerId: string,
  from: string,
  to: string,
): Promise<
  | {
      ok: true;
      account: GoogleAdsAccount;
      campaigns: GoogleAdsCampaignLine[];
      summary: GoogleAdsSummary;
      readAt: string;
    }
  | { ok: false; detail: string }
> {
  const config = await readGoogleAdsAppConfig(admin, organizationId);
  if (!config) return { ok: false, detail: "Google Ads não configurado na instalação" };
  const connection = await readGoogleAdsConnection(admin, organizationId);
  if (!connection.ok) return { ok: false, detail: connection.reason };

  const { data: stored } = await admin
    .from("ad_accounts")
    .select("external_account_id,name,currency,time_zone,status,is_manager,parent_external_account_id,metadata")
    .eq("organization_id", organizationId)
    .eq("platform", "google_ads")
    .eq("external_account_id", customerId)
    .maybeSingle();

  let account: GoogleAdsAccount | null = null;
  if (stored) {
    const metadata =
      stored.metadata && typeof stored.metadata === "object"
        ? (stored.metadata as Record<string, unknown>)
        : {};
    account = {
      customerId: stored.external_account_id as string,
      name: stored.name as string,
      currency: (stored.currency as string | null) ?? null,
      timeZone: (stored.time_zone as string | null) ?? null,
      status: (stored.status as string | null) ?? null,
      isManager: Boolean(stored.is_manager),
      loginCustomerId:
        typeof metadata.login_customer_id === "string" ? metadata.login_customer_id : null,
      parentCustomerId: (stored.parent_external_account_id as string | null) ?? null,
    };
  }

  if (!account) {
    const discovered = await discoverGoogleAdsAccounts(admin, organizationId);
    if (!discovered.ok) return discovered;
    account = discovered.accounts.find((candidate) => candidate.customerId === customerId) ?? null;
  }
  if (!account) return { ok: false, detail: "conta não encontrada" };
  if (account.isManager) return { ok: false, detail: "selecione uma conta cliente, não uma conta MCC" };

  const run = await admin
    .from("ad_sync_runs")
    .insert({
      organization_id: organizationId,
      platform: "google_ads",
      external_account_id: account.customerId,
      status: "running",
      date_from: from,
      date_to: to,
    })
    .select("id")
    .single();

  if (run.error || !run.data?.id) {
    return { ok: false, detail: `ad_sync_runs: ${run.error?.message ?? "não foi possível registrar a sincronização"}` };
  }

  const session = sessionFromConfig(config, connection.accessToken, account.loginCustomerId);
  const result = await getGoogleAdsCampaignDays(account.customerId, from, to, session);

  if (!result.ok) {
    if (run.data?.id) {
      await admin
        .from("ad_sync_runs")
        .update({
          status: "failed",
          error_code: "google_ads_api",
          error_detail: result.detail.slice(0, 1000),
          finished_at: new Date().toISOString(),
        })
        .eq("id", run.data.id);
    }
    return result;
  }

  try {
    await persistCampaignDays(admin, organizationId, account, result.rows);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "falha ao persistir histórico do Google Ads";
    await admin
      .from("ad_sync_runs")
      .update({
        status: "failed",
        error_code: "persistence_error",
        error_detail: detail.slice(0, 1000),
        finished_at: new Date().toISOString(),
      })
      .eq("id", run.data.id);
    return { ok: false, detail };
  }

  const grouped = new Map<string, GoogleAdsCampaignLine>();
  for (const row of result.rows) {
    const current = grouped.get(row.campaignId) ?? {
      campaignId: row.campaignId,
      name: row.campaignName,
      status: row.status,
      channelType: row.channelType,
      spend: 0,
      impressions: 0,
      clicks: 0,
      interactions: 0,
      conversions: 0,
      conversionValue: 0,
      viewThroughConversions: 0,
      ctr: null,
      cpc: null,
      cpm: null,
      costPerConversion: null,
      roas: null,
    };
    current.spend += moneyFromMicros(row.costMicros);
    current.impressions += row.impressions ?? 0;
    current.clicks += row.clicks ?? 0;
    current.interactions += row.interactions ?? 0;
    current.conversions += row.conversions ?? 0;
    current.conversionValue += row.conversionValue ?? 0;
    current.viewThroughConversions += row.viewThroughConversions ?? 0;
    current.name = row.campaignName;
    current.status = row.status;
    current.channelType = row.channelType;
    grouped.set(row.campaignId, current);
  }

  const campaigns = [...grouped.values()];
  for (const campaign of campaigns) {
    campaign.ctr = ratio(campaign.clicks, campaign.impressions, 100);
    campaign.cpc = ratio(campaign.spend, campaign.clicks);
    campaign.cpm = ratio(campaign.spend, campaign.impressions, 1000);
    campaign.costPerConversion = ratio(campaign.spend, campaign.conversions);
    campaign.roas = ratio(campaign.conversionValue, campaign.spend);
  }

  const summary = campaigns.reduce<GoogleAdsSummary>(
    (acc, campaign) => {
      acc.spend += campaign.spend;
      acc.impressions += campaign.impressions;
      acc.clicks += campaign.clicks;
      acc.conversions += campaign.conversions;
      acc.conversionValue += campaign.conversionValue;
      return acc;
    },
    {
      spend: 0,
      impressions: 0,
      clicks: 0,
      conversions: 0,
      conversionValue: 0,
      ctr: null,
      cpc: null,
      cpm: null,
      costPerConversion: null,
      roas: null,
    },
  );
  summary.ctr = ratio(summary.clicks, summary.impressions, 100);
  summary.cpc = ratio(summary.spend, summary.clicks);
  summary.cpm = ratio(summary.spend, summary.impressions, 1000);
  summary.costPerConversion = ratio(summary.spend, summary.conversions);
  summary.roas = ratio(summary.conversionValue, summary.spend);

  const { error: finishError } = await admin
    .from("ad_sync_runs")
    .update({
      status: "succeeded",
      accounts_seen: 1,
      campaigns_seen: campaigns.length,
      metric_rows_written: result.rows.length,
      finished_at: new Date().toISOString(),
    })
    .eq("id", run.data.id);
  if (finishError) return { ok: false, detail: `ad_sync_runs: ${finishError.message}` };

  return { ok: true, account, campaigns, summary, readAt: new Date().toISOString() };
}
