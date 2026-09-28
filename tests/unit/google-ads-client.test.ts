import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getGoogleAdsCampaignDays,
  listAccessibleGoogleAdsCustomers,
  type GoogleAdsSession,
} from "@/lib/plataformas-de-anuncio/google/client";

const SESSION: GoogleAdsSession = {
  accessToken: "access-token",
  developerToken: "developer-token",
  loginCustomerId: "123-456-7890",
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Google Ads REST client", () => {
  it("normaliza os customer IDs retornados por listAccessibleCustomers", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          resourceNames: [
            "customers/123-456-7890",
            "customers/9998887777",
          ],
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await listAccessibleGoogleAdsCustomers(SESSION);

    expect(result).toEqual({
      ok: true,
      customerIds: ["1234567890", "9998887777"],
    });
  });

  it("lê SearchStream e preserva precisão sem inventar métricas", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            results: [
              {
                segments: { date: "2026-09-20" },
                campaign: {
                  id: "777",
                  name: "Pesquisa institucional",
                  status: "ENABLED",
                  advertisingChannelType: "SEARCH",
                  startDate: "2026-09-01",
                  endDate: "2037-12-30",
                },
                metrics: {
                  costMicros: "1230000",
                  impressions: "1000",
                  clicks: "25",
                  interactions: "30",
                  conversions: "2.5",
                  allConversions: "3",
                  conversionsValue: "500.25",
                  allConversionsValue: "600.50",
                  viewThroughConversions: "1",
                },
              },
              {
                segments: { date: "2026-09-20" },
                campaign: {
                  id: "888",
                  name: "Performance Max",
                  status: "ENABLED",
                  advertisingChannelType: "PERFORMANCE_MAX",
                  startDate: "2026-09-05",
                  endDate: "2037-12-30",
                },
                metrics: {
                  costMicros: "2500000",
                  impressions: "2000",
                  clicks: "40",
                  interactions: "45",
                  conversions: "4",
                  allConversions: "5",
                  conversionsValue: "900",
                  allConversionsValue: "950",
                  viewThroughConversions: "2",
                },
              },
            ],
          },
        ]),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await getGoogleAdsCampaignDays(
      "123-456-7890",
      "2026-09-20",
      "2026-09-20",
      SESSION,
    );

    expect(result).toEqual({
      ok: true,
      rows: [
        {
          date: "2026-09-20",
          campaignId: "777",
          campaignName: "Pesquisa institucional",
          status: "ENABLED",
          channelType: "SEARCH",
          startDate: "2026-09-01",
          endDate: "2037-12-30",
          costMicros: 1230000,
          impressions: 1000,
          clicks: 25,
          interactions: 30,
          conversions: 2.5,
          allConversions: 3,
          conversionValue: 500.25,
          allConversionValue: 600.5,
          viewThroughConversions: 1,
        },
        {
          date: "2026-09-20",
          campaignId: "888",
          campaignName: "Performance Max",
          status: "ENABLED",
          channelType: "PERFORMANCE_MAX",
          startDate: "2026-09-05",
          endDate: "2037-12-30",
          costMicros: 2500000,
          impressions: 2000,
          clicks: 40,
          interactions: 45,
          conversions: 4,
          allConversions: 5,
          conversionValue: 900,
          allConversionValue: 950,
          viewThroughConversions: 2,
        },
      ],
    });

    const firstCall = fetchMock.mock.calls[0];
    expect(firstCall).toBeDefined();
    if (!firstCall) throw new Error("fetch do Google Ads não foi chamado");

    const [request, init] = firstCall;
    expect(String(request)).toContain(
      "/v25/customers/1234567890/googleAds:searchStream",
    );

    const headers = new Headers(init?.headers);
    expect(headers.get("developer-token")).toBe("developer-token");
    expect(headers.get("login-customer-id")).toBe("1234567890");
    expect(headers.get("authorization")).toBe("Bearer access-token");

    const body = JSON.parse(String(init?.body ?? "{}")) as { query?: string };
    expect(body.query).toContain(
      "WHERE segments.date BETWEEN '2026-09-20' AND '2026-09-20'",
    );
  });
});
