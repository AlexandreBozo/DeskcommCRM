import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";

import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSupportWrite } from "@/lib/impersonate/support";

export const dynamic = "force-dynamic";
type RoleRow = { code: string; deleted_at: string | null };
type MembershipWithRoles = { id: string; member_roles: Array<{ roles: RoleRow | null }> | null };

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ user_id: string }> },
): Promise<Response> {
  const supportDenied = await requireSupportWrite();
  if (supportDenied) return supportDenied;
  const requestId = randomUUID();
  const { user_id: targetUserId } = await ctx.params;
  const authz = await requireRole("admin", { requestId, resource: "team" });
  if (!authz.ok) return authz.response;
  if (targetUserId === authz.user.id) {
    return fail("state_conflict", "Não é possível revogar o próprio acesso.", 409, { requestId });
  }

  const admin = createAdminClient();
  const { data: target, error } = await admin
    .from("organization_members")
    .select("id, member_roles(roles(code, deleted_at))")
    .eq("organization_id", authz.org.orgId)
    .eq("user_id", targetUserId)
    .eq("status", "active")
    .is("deleted_at", null)
    .maybeSingle();
  if (error) return fail("internal_error", error.message, 500, { requestId });
  if (!target) return fail("not_found", "Membro não encontrado.", 404, { requestId });

  const targetMembership = target as unknown as MembershipWithRoles;
  const targetIsAdmin = (targetMembership.member_roles ?? []).some((entry) => {
    const code = entry.roles?.code;
    return !entry.roles?.deleted_at && (code === "org_admin" || code === "admin");
  });
  if (targetIsAdmin) {
    const { data: admins, error: adminsError } = await admin
      .from("organization_members")
      .select("id, member_roles(roles(code, deleted_at))")
      .eq("organization_id", authz.org.orgId)
      .eq("status", "active")
      .is("deleted_at", null);
    if (adminsError) return fail("internal_error", adminsError.message, 500, { requestId });
    const adminCount = ((admins ?? []) as unknown as MembershipWithRoles[]).filter((member) =>
      (member.member_roles ?? []).some((entry) => !entry.roles?.deleted_at && (entry.roles?.code === "org_admin" || entry.roles?.code === "admin")),
    ).length;
    if (adminCount <= 1) return fail("state_conflict", "Não é possível revogar o último admin do tenant.", 409, { requestId });
  }

  const now = new Date().toISOString();
  const { error: updateError } = await admin
    .from("organization_members")
    .update({ status: "removed", deleted_at: now, updated_at: now })
    .eq("id", target.id);
  if (updateError) return fail("internal_error", updateError.message, 500, { requestId });
  void audit({ action: "member.revoked", actorUserId: authz.user.id, organizationId: authz.org.orgId, resourceType: "membership", resourceId: target.id, requestId, metadata: { target_user_id: targetUserId } });
  return ok({ user_id: targetUserId, revoked_at: now }, { requestId });
}
