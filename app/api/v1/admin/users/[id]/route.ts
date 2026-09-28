import { type NextRequest } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { createAdminClient } from "@/lib/supabase/admin";
import { type CanonicalFrom } from "@/lib/supabase/canonical-query";
import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";
import { randomUUID } from "node:crypto";

// ---------------------------------------------------------------------------
// GET /api/v1/admin/users/[id]
// ---------------------------------------------------------------------------

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = randomUUID();
  const { id } = await params;

  let adminCtx: Awaited<ReturnType<typeof requirePlatformAdmin>>;
  try {
    adminCtx = await requirePlatformAdmin();
  } catch {
    return fail("forbidden", "Platform admin required", 403, { requestId });
  }

  const admin = createAdminClient();
  const canonicalFrom = admin.from.bind(admin) as unknown as CanonicalFrom;

  // Load auth user via admin auth API
  const { data: authUserData, error: authError } =
    await admin.auth.admin.getUserById(id);

  if (authError || !authUserData?.user) {
    return fail("not_found", "User not found", 404, { requestId });
  }

  const authUser = authUserData.user;

  // Load canonical memberships, roles, and organizations.
  const { data: memberships, error: membershipError } = await canonicalFrom("organization_members")
    .select(
      `
      organization_id,
      status,
      joined_at,
      deleted_at,
      member_roles(roles(code, deleted_at)),
      organizations!inner(name, slug, deleted_at)
    `,
    )
    .eq("user_id", id)
    .eq("status", "active")
    .is("deleted_at", null)
    .is("organizations.deleted_at", null)
    .order("joined_at", { ascending: false });

  if (membershipError) {
    return fail("internal_error", "Membership query failed", 500, {
      requestId,
      details: membershipError.message,
    });
  }

  type RawMembership = {
    organization_id: string;
    joined_at: string | null;
    deleted_at: string | null;
    member_roles: Array<{ roles: { code: string; deleted_at: string | null } | null }> | null;
    organizations: { name: string; slug: string; deleted_at: string | null } | null;
  };

  const normalizeRole = (membership: RawMembership): "admin" | "manager" | "agent" | "viewer" => {
    const codes = (membership.member_roles ?? [])
      .map((memberRole) => memberRole.roles)
      .filter((memberRole): memberRole is { code: string; deleted_at: string | null } => memberRole !== null && memberRole.deleted_at === null)
      .map((memberRole) => memberRole.code);
    if (codes.some((code) => code === "org_admin" || code === "admin")) return "admin";
    if (codes.includes("manager")) return "manager";
    if (codes.includes("agent")) return "agent";
    return "viewer";
  };

  const formattedMemberships = ((memberships ?? []) as unknown as RawMembership[]).map(
    (membership) => ({
      organization_id: membership.organization_id,
      tenant_name: membership.organizations?.name ?? null,
      tenant_slug: membership.organizations?.slug ?? null,
      role: normalizeRole(membership),
      accepted_at: membership.joined_at,
      revoked_at: membership.deleted_at,
    }),
  );

  // Load recent audit entries where actor_user_id = id (LIMIT 50)
  const { data: recentAudit, error: auditError } = await admin
    .from("api_audit_log")
    .select(
      "id, action, organization_id, resource_type, resource_id, created_at, metadata",
    )
    .eq("actor_user_id", id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (auditError) {
    // Non-fatal: return empty array and continue
  }

  const userMeta = authUser.user_metadata as Record<string, unknown> | null;

  const userPayload = {
    id: authUser.id,
    email: authUser.email ?? null,
    full_name: (userMeta?.full_name as string | undefined) ?? null,
    phone: authUser.phone ?? null,
    last_sign_in_at: authUser.last_sign_in_at ?? null,
    created_at: authUser.created_at,
    email_confirmed_at: authUser.email_confirmed_at ?? null,
    factors: (authUser.factors ?? []).map((f) => ({
      id: f.id,
      type: f.factor_type,
      status: f.status,
    })),
  };

  void audit({
    action: "platform_admin.user_viewed",
    actorUserId: adminCtx.user.id,
    actingAsPlatformAdmin: true,
    bypassedRls: true,
    resourceType: "user",
    resourceId: id,
    requestId,
    metadata: {
      email_hash: authUser.email
        ? Buffer.from(authUser.email.toLowerCase()).toString("hex").slice(0, 12) +
          "..."
        : null,
    },
  });

  return ok(
    {
      user: userPayload,
      memberships: formattedMemberships,
      recent_audit: recentAudit ?? [],
    },
    { requestId },
  );
}
