import { randomUUID } from "node:crypto";
import { type NextRequest } from "next/server";

import { audit } from "@/lib/audit";
import { fail, ok } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { requireSupportWrite } from "@/lib/impersonate/support";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;

  const requestId = req.headers.get("x-request-id") ?? randomUUID();
  const authz = await requireRole("admin", { requestId, resource: "google_ads_connections" });
  if (!authz.ok) return authz.response;

  const admin = createAdminClient();
  const { error } = await admin
    .from("google_ads_connections")
    .delete()
    .eq("organization_id", authz.org.orgId);

  if (error) {
    return fail("google_ads_disconnect_failed", "Não consegui desconectar o Google Ads.", 500, {
      requestId,
      details: error.message,
    });
  }

  await audit({
    action: "google_ads.conexao_desconectada",
    actorUserId: authz.user.id,
    organizationId: authz.org.orgId,
    resourceType: "google_ads_connections",
    requestId,
  });

  // Histórico de métricas não é apagado. Desconectar revoga apenas a capacidade
  // de fazer novas leituras; relatório passado não deve desaparecer junto do token.
  return ok({ disconnected: true }, { requestId });
}
