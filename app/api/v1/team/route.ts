import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";

import { ok, fail } from "@/lib/api/wrappers";
import { requireRole } from "@/lib/auth/require-role";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const ROLE_BY_CODE: Record<string, "admin" | "manager" | "agent" | "viewer"> = {
  org_admin: "admin", admin: "admin", manager: "manager", agent: "agent", viewer: "viewer", ricardo_viewer: "viewer",
};
type RoleRow = { code: string; deleted_at: string | null };
type MembershipRow = { user_id: string; created_at: string; joined_at: string | null; member_roles: Array<{ roles: RoleRow | null }> | null };

export async function GET(_req: NextRequest): Promise<Response> {
  const requestId = randomUUID();
  const authz = await requireRole("manager", { requestId, resource: "team" });
  if (!authz.ok) return authz.response;
  const admin = createAdminClient();
  const { data: memberships, error } = await admin
    .from("organization_members")
    .select("id, user_id, status, joined_at, created_at, member_roles(roles(code, deleted_at))")
    .eq("organization_id", authz.org.orgId)
    .eq("status", "active")
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  if (error) return fail("internal_error", error.message, 500, { requestId });

  const members = await Promise.all(((memberships ?? []) as unknown as MembershipRow[]).map(async (membership) => {
    const codes = (membership.member_roles ?? []).map((entry) => entry.roles).filter((role): role is RoleRow => role !== null && !role.deleted_at).map((role) => role.code);
    const role = codes.map((code: string) => ROLE_BY_CODE[code]).find(Boolean) ?? "viewer";
    const { data } = await admin.auth.admin.getUserById(membership.user_id);
    const user = data?.user;
    return {
      user_id: membership.user_id,
      role,
      interface_settings: { preset: "completa" },
      invited_at: membership.created_at,
      accepted_at: membership.joined_at,
      revoked_at: null,
      created_at: membership.created_at,
      email: user?.email ?? null,
      full_name: (user?.user_metadata?.full_name as string | undefined) ?? null,
      last_sign_in_at: user?.last_sign_in_at ?? null,
    };
  }));
  return ok(members, { requestId });
}
