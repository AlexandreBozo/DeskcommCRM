import {
  GOOGLE_ADS_API_VERSION,
  type GoogleAdsConfig,
} from "./config";

export interface GoogleAdsSession {
  accessToken: string;
  developerToken?: string | null;
  loginCustomerId?: string | null;
}

export interface GoogleAdsAccount {
  customerId: string;
  name: string;
  currency: string | null;
  timeZone: string | null;
  status: string | null;
  isManager: boolean;
  loginCustomerId: string | null;
  parentCustomerId: string | null;
}

export interface GoogleAdsCampaignDay {
  date: string;
  campaignId: string;
  campaignName: string;
  status: string | null;
  channelType: string | null;
  startDate: string | null;
  endDate: string | null;
  costMicros: number | null;
  impressions: number | null;
  clicks: number | null;
  interactions: number | null;
  conversions: number | null;
  allConversions: number | null;
  conversionValue: number | null;
  allConversionValue: number | null;
  viewThroughConversions: number | null;
}

type SearchBatch = { results?: Array<Record<string, unknown>> };

function requestHeaders(session: GoogleAdsSession): HeadersInit {
  const out: Record<string, string> = {
    authorization: `Bearer ${session.accessToken}`,
    "content-type": "application/json",
  };
  if (session.developerToken) {
    out["developer-token"] = session.developerToken;
  }
  if (session.loginCustomerId) {
    out["login-customer-id"] = session.loginCustomerId.replace(/\D/g, "");
  }
  return out;
}

function detailFromError(body: unknown, status: number): string {
  if (body && typeof body === "object") {
    const error = (body as Record<string, unknown>).error;
    if (error && typeof error === "object") {
      const message = (error as Record<string, unknown>).message;
      if (typeof message === "string" && message) return message;
    }
  }
  return `Google Ads HTTP ${status}`;
}

async function requestJson(
  path: string,
  session: GoogleAdsSession,
  init: RequestInit,
): Promise<{ ok: true; body: unknown } | { ok: false; detail: string; status: number }> {
  let response: Response;
  try {
    response = await fetch(
      `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}${path}`,
      {
        ...init,
        headers: { ...requestHeaders(session), ...(init.headers ?? {}) },
        cache: "no-store",
        signal: AbortSignal.timeout(25_000),
      },
    );
  } catch (error) {
    return {
      ok: false,
      status: 0,
      detail: error instanceof Error ? error.message : "falha de rede",
    };
  }

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      detail: detailFromError(body, response.status),
    };
  }
  return { ok: true, body };
}

export async function listAccessibleGoogleAdsCustomers(
  session: GoogleAdsSession,
): Promise<{ ok: true; customerIds: string[] } | { ok: false; detail: string }> {
  const result = await requestJson("/customers:listAccessibleCustomers", session, {
    method: "GET",
  });
  if (!result.ok) return result;
  const names =
    result.body && typeof result.body === "object"
      ? (result.body as { resourceNames?: unknown }).resourceNames
      : [];
  const customerIds = Array.isArray(names)
    ? names
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.replace(/^customers\//, "").replace(/\D/g, ""))
        .filter(Boolean)
    : [];
  return { ok: true, customerIds };
}

export async function googleAdsSearchStream(
  customerId: string,
  query: string,
  session: GoogleAdsSession,
): Promise<{ ok: true; rows: Array<Record<string, unknown>> } | { ok: false; detail: string }> {
  const id = customerId.replace(/\D/g, "");
  const result = await requestJson(`/customers/${id}/googleAds:searchStream`, session, {
    method: "POST",
    body: JSON.stringify({ query }),
  });
  if (!result.ok) return result;

  const batches = Array.isArray(result.body) ? (result.body as SearchBatch[]) : [];
  const rows = batches.flatMap((batch) =>
    Array.isArray(batch?.results) ? batch.results : [],
  );
  return { ok: true, rows };
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberOrNull(value: unknown): number | null {
  const n =
    typeof value === "string" || typeof value === "number" ? Number(value) : Number.NaN;
  return Number.isFinite(n) ? n : null;
}

function bool(value: unknown): boolean {
  return value === true;
}

export async function getGoogleAdsCustomer(
  customerId: string,
  session: GoogleAdsSession,
): Promise<{ ok: true; account: GoogleAdsAccount } | { ok: false; detail: string }> {
  const query = `
    SELECT
      customer.id,
      customer.descriptive_name,
      customer.currency_code,
      customer.time_zone,
      customer.manager,
      customer.status
    FROM customer
    LIMIT 1
  `;
  const result = await googleAdsSearchStream(customerId, query, session);
  if (!result.ok) return result;
  const row = result.rows[0];
  if (!row) return { ok: false, detail: "conta não retornada pelo Google Ads" };

  const customer = object(row.customer);
  const id = String(customer.id ?? customerId).replace(/\D/g, "");
  return {
    ok: true,
    account: {
      customerId: id,
      name: stringOrNull(customer.descriptiveName) ?? id,
      currency: stringOrNull(customer.currencyCode),
      timeZone: stringOrNull(customer.timeZone),
      status: stringOrNull(customer.status),
      isManager: bool(customer.manager),
      loginCustomerId: session.loginCustomerId ?? null,
      parentCustomerId: null,
    },
  };
}

export async function listGoogleAdsManagerChildren(
  managerId: string,
  session: GoogleAdsSession,
): Promise<{ ok: true; accounts: GoogleAdsAccount[] } | { ok: false; detail: string }> {
  const query = `
    SELECT
      customer_client.client_customer,
      customer_client.descriptive_name,
      customer_client.currency_code,
      customer_client.time_zone,
      customer_client.manager,
      customer_client.status,
      customer_client.level
    FROM customer_client
    WHERE customer_client.level <= 1
  `;
  const result = await googleAdsSearchStream(managerId, query, {
    ...session,
    loginCustomerId: managerId,
  });
  if (!result.ok) return result;

  const accounts = result.rows
    .map((row) => object(row.customerClient))
    .map((client): GoogleAdsAccount | null => {
      const resource = stringOrNull(client.clientCustomer);
      const id = resource?.replace(/^customers\//, "").replace(/\D/g, "") ?? "";
      if (!id) return null;
      return {
        customerId: id,
        name: stringOrNull(client.descriptiveName) ?? id,
        currency: stringOrNull(client.currencyCode),
        timeZone: stringOrNull(client.timeZone),
        status: stringOrNull(client.status),
        isManager: bool(client.manager),
        loginCustomerId: managerId,
        parentCustomerId: id === managerId ? null : managerId,
      };
    })
    .filter((value): value is GoogleAdsAccount => value !== null);

  return { ok: true, accounts };
}

export async function getGoogleAdsCampaignDays(
  customerId: string,
  from: string,
  to: string,
  session: GoogleAdsSession,
): Promise<{ ok: true; rows: GoogleAdsCampaignDay[] } | { ok: false; detail: string }> {
  const query = `
    SELECT
      segments.date,
      campaign.id,
      campaign.name,
      campaign.status,
      campaign.advertising_channel_type,
      campaign.start_date,
      campaign.end_date,
      metrics.cost_micros,
      metrics.impressions,
      metrics.clicks,
      metrics.interactions,
      metrics.conversions,
      metrics.all_conversions,
      metrics.conversions_value,
      metrics.all_conversions_value,
      metrics.view_through_conversions
    FROM campaign
    WHERE segments.date BETWEEN '${from}' AND '${to}'
    ORDER BY segments.date, campaign.id
  `;
  const result = await googleAdsSearchStream(customerId, query, session);
  if (!result.ok) return result;

  const rows = result.rows
    .map((row): GoogleAdsCampaignDay | null => {
      const segments = object(row.segments);
      const campaign = object(row.campaign);
      const metrics = object(row.metrics);
      const date = stringOrNull(segments.date);
      const campaignId = String(campaign.id ?? "").replace(/\D/g, "");
      if (!date || !campaignId) return null;

      return {
        date,
        campaignId,
        campaignName: stringOrNull(campaign.name) ?? campaignId,
        status: stringOrNull(campaign.status),
        channelType: stringOrNull(campaign.advertisingChannelType),
        startDate: stringOrNull(campaign.startDate),
        endDate: stringOrNull(campaign.endDate),
        costMicros: numberOrNull(metrics.costMicros),
        impressions: numberOrNull(metrics.impressions),
        clicks: numberOrNull(metrics.clicks),
        interactions: numberOrNull(metrics.interactions),
        conversions: numberOrNull(metrics.conversions),
        allConversions: numberOrNull(metrics.allConversions),
        conversionValue: numberOrNull(metrics.conversionsValue),
        allConversionValue: numberOrNull(metrics.allConversionsValue),
        viewThroughConversions: numberOrNull(metrics.viewThroughConversions),
      };
    })
    .filter((value): value is GoogleAdsCampaignDay => value !== null);

  return { ok: true, rows };
}

export function sessionFromConfig(
  config: GoogleAdsConfig,
  accessToken: string,
  loginCustomerId?: string | null,
): GoogleAdsSession {
  return {
    accessToken,
    developerToken: config.developerToken,
    loginCustomerId: loginCustomerId ?? null,
  };
}
