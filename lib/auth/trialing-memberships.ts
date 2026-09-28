import { logger } from "@/lib/logger";
import { lerInterface } from "@/lib/navigation/interface";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Role, UserOrgMembership } from "@/lib/auth/types";

type TrialingMembershipRow = {
  organization_id: string;
  member_roles: Array<{
    roles: { code: string; deleted_at: string | null } | null;
  }> | null;
  organizations: {
    name: string;
    status: string;
    deleted_at: string | null;
    metadata: unknown;
  } | null;
};

function papelDaMembership(row: TrialingMembershipRow): Role | null {
  const codes = (row.member_roles ?? [])
    .map((entry) => entry.roles)
    .filter((role): role is { code: string; deleted_at: string | null } =>
      role !== null && role.deleted_at === null,
    )
    .map((role) => role.code);
  if (codes.some((code) => code === "org_admin" || code === "admin")) return "admin";
  if (codes.includes("manager")) return "manager";
  if (codes.includes("agent")) return "agent";
  if (codes.includes("viewer")) return "viewer";
  return null;
}

export function mapearMembershipsTrialing(
  rows: TrialingMembershipRow[],
): UserOrgMembership[] {
  return rows.flatMap((row) => {
    const organization = row.organizations;
    const role = papelDaMembership(row);
    if (!organization || organization.status !== "trialing" || organization.deleted_at || !role) {
      return [];
    }
    const metadata =
      organization.metadata && typeof organization.metadata === "object" && !Array.isArray(organization.metadata)
        ? organization.metadata as Record<string, unknown>
        : {};
    return [{
      organization_id: row.organization_id,
      organization_name: organization.name,
      role,
      locale: typeof metadata.locale === "string" ? metadata.locale : null,
      interface_settings: lerInterface(metadata.interface_settings).settings,
    }];
  });
}

export function mesclarMemberships(
  memberships: UserOrgMembership[],
  trialingMemberships: UserOrgMembership[],
): UserOrgMembership[] {
  const ids = new Set(memberships.map((membership) => membership.organization_id));
  return [
    ...memberships,
    ...trialingMemberships.filter((membership) => !ids.has(membership.organization_id)),
  ];
}

export async function listarMembershipsTrialing(
  userId: string,
  organizationId?: string,
): Promise<UserOrgMembership[]> {
  const admin = createAdminClient();
  let query = admin
    .from("organization_members")
    .select(
      "organization_id, member_roles(roles(code, deleted_at)), organizations!inner(name, status, deleted_at, metadata)",
    )
    .eq("user_id", userId)
    .eq("status", "active")
    .is("deleted_at", null)
    .eq("organizations.status", "trialing")
    .is("organizations.deleted_at", null)
    .order("joined_at", { ascending: true })
    .order("organization_id", { ascending: true });
  if (organizationId) query = query.eq("organization_id", organizationId);
  const { data, error } = await query;
  if (error) {
    logger.error("[auth] falha ao complementar memberships de tenants trialing", {
      user_id: userId,
      organization_id: organizationId ?? null,
      message: error.message,
    });
    return [];
  }
  return mapearMembershipsTrialing((data ?? []) as unknown as TrialingMembershipRow[]);
}
