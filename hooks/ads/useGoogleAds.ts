"use client";

import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/lib/api/client";
import type { GoogleAdsAccount } from "@/lib/plataformas-de-anuncio/google/client";
import type {
  GoogleAdsCampaignLine,
  GoogleAdsSummary,
} from "@/lib/plataformas-de-anuncio/google/sync";

export interface GoogleAdsAccountsResponse {
  accounts: GoogleAdsAccount[];
  default_customer_id: string | null;
  login_customer_id: string | null;
}

export interface GoogleAdsCampaignsResponse {
  account: GoogleAdsAccount;
  campaigns: GoogleAdsCampaignLine[];
  summary: GoogleAdsSummary;
  period: { from: string; to: string };
  read_at: string;
}

export function useGoogleAdsAccounts(enabled = true) {
  return useQuery({
    queryKey: ["ads", "google", "accounts"],
    queryFn: () =>
      apiClient.get<{ data: GoogleAdsAccountsResponse }>("/api/v1/ads/google/accounts"),
    enabled,
    staleTime: 5 * 60_000,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

export function useGoogleAdsCampaigns({
  customerId,
  from,
  to,
}: {
  customerId: string | null;
  from: string;
  to: string;
}) {
  return useQuery({
    queryKey: ["ads", "google", "campaigns", customerId, from, to],
    queryFn: () => {
      const query = new URLSearchParams({
        customer_id: customerId as string,
        from,
        to,
      });
      return apiClient.get<{ data: GoogleAdsCampaignsResponse }>(
        `/api/v1/ads/google/campaigns?${query}`,
        { timeoutMs: 60_000 },
      );
    },
    enabled: Boolean(customerId),
    staleTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  });
}
