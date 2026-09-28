import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api/wrappers";
import { ApiError } from "@/lib/api/types";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/require-role";
import { changeRoleSchema, validateRequest } from "@/lib/schemas";
import { createAdminClient } from "@/lib/supabase/admin";

const CODE_BY_ROLE = { admin: "org_admin", manager: "manager", agent: "agent", viewer: "viewer" } as const;

export async function changeMemberRole(req: NextRequest, ctx: { params: Promise<{ user_id: string }> }): Promise<Response> {
  const requestId = randomUUID();
  const { user_id: targetUserId } = await ctx.params;
  const authz = await requireRole("admin", { requestId, resource: "team" });
  if (!authz.ok) return authz.response;
  let input;
  try { input = await validateRequest(changeRoleSchema, req); }
  catch (error) { if (error instanceof ApiError) return fail(error.code, error.message, error.status, { details: error.details as Record<string, unknown> | undefined, requestId }); throw error; }
  const admin = createAdminClient();
  const { data: target, error } = await admin.from("organization_members").select("id, user_id").eq("organization_id", authz.org.orgId).eq("user_id", targetUserId).eq("status", "active").is("deleted_at", null).maybeSingle();
  if (error) return fail("internal_error", error.message, 500, { requestId });
  if (!target) return fail("not_found", "Membro não encontrado.", 404, { requestId });
  const { data: role, error: roleError } = await admin.from("roles").select("id").eq("organization_id", authz.org.orgId).eq("code", CODE_BY_ROLE[input.role]).is("deleted_at", null).maybeSingle();
  if (roleError || !role) return fail("internal_error", "Papel canônico não encontrado.", 500, { requestId });
  const { error: deleteError } = await admin.from("member_roles").delete().eq("member_id", target.id);
  if (deleteError) return fail("internal_error", deleteError.message, 500, { requestId });
  const { error: insertError } = await admin.from("member_roles").insert({ member_id: target.id, role_id: role.id, created_by: authz.user.id });
  if (insertError) return fail("internal_error", insertError.message, 500, { requestId });
  void audit({ action: "team.role_changed", actorUserId: authz.user.id, organizationId: authz.org.orgId, resourceType: "membership", resourceId: target.id, requestId, metadata: { target_user_id: targetUserId, new_role: input.role } });
  return ok({ user_id: targetUserId, role: input.role }, { requestId });
}
