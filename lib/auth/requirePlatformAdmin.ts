/**
 * Server guard for /admin/* (Super-Admin Platform sub-product).
 *
 * Flow:
 *  1. Load the canonical auth context, which validates the JWT and active
 *     platform-admin status through fn_auth_context().
 *  2. Redirect unauthenticated users to login and non-admins to forbidden.
 *
 * The canonical platform_admins contract only stores user_id, created_by,
 * created_at, and revoked_at. MFA policy is not represented there, so this
 * guard must not infer an AAL2 requirement from a legacy field.
 */
import { redirect } from "next/navigation";
import { loadAuthUser } from "@/lib/auth/server";
import type { AuthUser } from "@/lib/auth/types";

export interface PlatformAdminInfo {
  user_id: string;
  scope: "full";
  mfa_required: false;
}

export interface PlatformAdminContext {
  user: AuthUser;
  platformAdmin: PlatformAdminInfo;
}

export async function requirePlatformAdmin(): Promise<PlatformAdminContext> {
  const user = await loadAuthUser();
  if (!user) {
    redirect("/login?next=/admin");
  }

  if (!user.is_platform_admin) {
    redirect("/admin/forbidden");
  }

  return {
    user,
    platformAdmin: {
      user_id: user.id,
      scope: "full",
      mfa_required: false,
    },
  };
}
