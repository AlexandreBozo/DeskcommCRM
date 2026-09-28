"use server";
import { cookies } from "next/headers";
import { z } from "zod";
import { loadAuthUser, mfaEmDivida } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { cookieSecure } from "@/lib/supabase/cookie-secure";
import { audit } from "@/lib/audit";
import { listarMembershipsTrialing } from "@/lib/auth/trialing-memberships";

export async function setActiveOrg(orgId: string): Promise<{ ok: boolean; error?: string }> {
  if (!z.string().uuid().safeParse(orgId).success)
    return { ok: false, error: "invalid_organization" };
  const user = await loadAuthUser();
  if (!user) return { ok: false, error: "auth_required" };
  if (user.support)
    return { ok: false, error: "Encerre o acompanhamento antes de trocar de organização." };
  if (await mfaEmDivida()) return { ok: false, error: "mfa_required" };
  // Consulta fresca e user-scoped: a RPC valida membership e organização ativa.
  const db = await createClient();
  const { data: canAccess, error } = await db.rpc("fn_can_access_org", { p_org: orgId });
  const trialingAccess =
    !error && canAccess === true
      ? false
      : (await listarMembershipsTrialing(user.id, orgId)).some(
          (membership) => membership.organization_id === orgId,
        );
  if (!trialingAccess && (error || canAccess !== true)) {
    return { ok: false, error: "forbidden" };
  }
  const store = await cookies();
  const previous = store.get("active_org")?.value;
  store.set("active_org", orgId, {
    httpOnly: true,
    sameSite: "strict",
    secure: cookieSecure(),
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  await audit({
    action: "organization.switched",
    actorUserId: user.id,
    organizationId: orgId,
    resourceType: "organization",
    resourceId: orgId,
    metadata: {
      previous_organization_id: z.string().uuid().safeParse(previous).success ? previous : null,
    },
  });
  return { ok: true };
}
