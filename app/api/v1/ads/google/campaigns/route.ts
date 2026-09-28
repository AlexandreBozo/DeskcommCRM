import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";
import { z } from "zod";

import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { syncGoogleAdsCampaigns } from "@/lib/plataformas-de-anuncio/google/sync";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const querySchema = z
  .object({
    customer_id: z.string().regex(/^\d{6,20}$/, "customer_id inválido"),
    from: z.string().regex(DATE).optional(),
    to: z.string().regex(DATE).optional(),
  })
  .refine((v) => !v.from || !v.to || v.from <= v.to, {
    path: ["from"],
    message: "o início do período não pode ser depois do fim",
  });

function dateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function defaultPeriod(): { from: string; to: string } {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const first = new Date(yesterday.getTime() - 6 * 24 * 60 * 60 * 1000);
  return { from: dateOnly(first), to: dateOnly(yesterday) };
}

export async function GET(req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "ads_insights" });
  if (!authz.ok) return authz.response;

  const parsed = querySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) {
    return fail("validation_failed", "Parâmetros inválidos.", 422, {
      requestId,
      details: parsed.error.flatten(),
    });
  }

  const fallback = defaultPeriod();
  const from = parsed.data.from ?? fallback.from;
  const to = parsed.data.to ?? fallback.to;

  const result = await syncGoogleAdsCampaigns(
    createAdminClient(),
    authz.org.orgId,
    parsed.data.customer_id,
    from,
    to,
  );
  if (!result.ok) {
    return fail(
      "google_ads_upstream_error",
      "Não consegui carregar as campanhas do Google Ads agora.",
      502,
      { requestId, details: result.detail },
    );
  }

  return ok(
    {
      account: result.account,
      campaigns: result.campaigns,
      summary: result.summary,
      period: { from, to },
      read_at: result.readAt,
    },
    { requestId },
  );
}
