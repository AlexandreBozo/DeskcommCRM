import { type NextRequest } from "next/server";
import { z } from "zod";
import { createHash, randomUUID } from "node:crypto";
import { createTenantSchema } from "@/lib/schemas/tenant-creation";
import { issueInvite } from "@/lib/auth/issue-invite";
import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { createAdminClient } from "@/lib/supabase/admin";
import { type CanonicalFrom } from "@/lib/supabase/canonical-query";
import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";

const querySchema = z.object({
  q: z.string().optional(),
  status: z.enum(["active", "suspended", "onboarding", "redacted"]).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

interface CursorPayload {
  created_at: string;
  id: string;
}

function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function decodeCursor(cursor: string): CursorPayload | null {
  try {
    return JSON.parse(Buffer.from(cursor, "base64url").toString("utf-8")) as CursorPayload;
  } catch {
    return null;
  }
}

type OrganizationRow = {
  id: string;
  name: string;
  slug: string;
  status: string;
  primary_domain: string | null;
  subdomain: string | null;
  metadata: unknown;
  created_at: string;
};

export async function GET(req: NextRequest) {
  const requestId = randomUUID();
  let adminCtx: Awaited<ReturnType<typeof requirePlatformAdmin>>;
  try {
    adminCtx = await requirePlatformAdmin();
  } catch {
    return fail("forbidden", "Platform admin required", 403, { requestId });
  }

  const parsed = querySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams.entries()));
  if (!parsed.success) {
    return fail("validation_error", "Invalid query params", 400, {
      requestId,
      details: parsed.error.flatten(),
    });
  }

  const { q, status, cursor, limit } = parsed.data;
  const admin = createAdminClient();
  const canonicalFrom = admin.from.bind(admin) as unknown as CanonicalFrom;
  const cursorPayload = cursor ? decodeCursor(cursor) : null;
  let query = canonicalFrom("organizations")
    .select("id, name, slug, status, primary_domain, subdomain, metadata, created_at")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit + 1);

  if (status) query = query.eq("status", status);
  if (q) query = query.or(`name.ilike.%${q}%,slug.ilike.%${q}%`);
  if (cursorPayload) {
    query = query.or(`created_at.lt.${cursorPayload.created_at},and(created_at.eq.${cursorPayload.created_at},id.lt.${cursorPayload.id})`);
  }

  const { data, error } = await query;
  if (error) return fail("internal_error", "Query failed", 500, { requestId, details: error.message });

  const rows = (data ?? []) as unknown as OrganizationRow[];
  const has_more = rows.length > limit;
  const page = has_more ? rows.slice(0, limit) : rows;
  const lastRow = page.at(-1);
  const nextCursor = has_more && lastRow ? encodeCursor({ created_at: lastRow.created_at, id: lastRow.id }) : null;
  const organizationIds = page.map((organization) => organization.id);
  const { data: memberships, error: membershipsError } = organizationIds.length
    ? await canonicalFrom("organization_members")
        .select("organization_id")
        .in("organization_id", organizationIds)
        .eq("status", "active")
        .is("deleted_at", null)
    : { data: [], error: null };

  if (membershipsError) {
    return fail("internal_error", "Membership query failed", 500, {
      requestId,
      details: membershipsError.message,
    });
  }

  const membershipCounts = new Map<string, number>();
  for (const membership of memberships ?? []) {
    membershipCounts.set(
      membership.organization_id,
      (membershipCounts.get(membership.organization_id) ?? 0) + 1,
    );
  }
  const tenants = page.map(({ name, ...organization }) => ({
    ...organization,
    name,
    display_name: name,
    user_count: membershipCounts.get(organization.id) ?? 0,
  }));

  void audit({
    action: "platform_admin.tenants_listed",
    actorUserId: adminCtx.user.id,
    actingAsPlatformAdmin: true,
    bypassedRls: true,
    requestId,
    metadata: { filters: { status: status ?? null, has_q: !!q }, result_count: tenants.length },
  });
  return ok(tenants, { requestId, meta: { has_more, cursor: nextCursor } });
}

export async function POST(req: NextRequest) {
  const requestId = randomUUID();
  let adminCtx: Awaited<ReturnType<typeof requirePlatformAdmin>>;
  try {
    adminCtx = await requirePlatformAdmin();
  } catch {
    return fail("forbidden", "Platform admin required", 403, { requestId });
  }
  let rawInput: unknown;
  try { rawInput = await req.json(); } catch { return fail("validation_error", "Invalid JSON body", 400, { requestId }); }
  const parsed = createTenantSchema.safeParse(rawInput);
  if (!parsed.success) return fail("validation_error", "Invalid tenant data", 400, { requestId, details: parsed.error.flatten() });
  const rawKey = req.headers.get("idempotency-key");
  const idempotencyKey = rawKey && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(rawKey) ? rawKey : null;
  if (!idempotencyKey) return fail("validation_error", "Idempotency-Key UUID is required", 400, { requestId });
  const input = parsed.data;
  const canonicalRequest = { name: input.display_name, slug: input.slug, metadata: { plan: input.plan, legal_name: input.legal_name || null, cnpj: input.cnpj || null } };
  const requestHash = createHash("sha256").update(JSON.stringify(canonicalRequest)).digest("hex");
  const admin = createAdminClient();
  const { data: provisioned, error: provisionError } = await admin.rpc("fn_provision_tenant", { p_actor: adminCtx.user.id, p_key: idempotencyKey, p_request: canonicalRequest, p_hash: requestHash });
  if (provisionError || !provisioned || typeof provisioned !== "object") {
    const code = provisionError?.code === "23505" ? "conflict" : "internal_error";
    return fail(code, provisionError?.message ?? "Tenant provisioning failed", code === "conflict" ? 409 : 500, { requestId });
  }
  const tenant = provisioned as { id: string; name: string; slug: string; created: boolean };
  const { data: verifiedOrg, error: verifyOrgError } = await admin.from("organizations").select("id, name, slug, status").eq("id", tenant.id).is("deleted_at", null).maybeSingle();
  const { data: verifiedMembership, error: verifyMembershipError } = await admin.from("organization_members").select("id").eq("organization_id", tenant.id).eq("user_id", adminCtx.user.id).eq("status", "active").is("deleted_at", null).maybeSingle();
  if (verifyOrgError || verifyMembershipError || !verifiedOrg || !verifiedMembership) return fail("internal_error", "Tenant provisioning verification failed", 500, { requestId });
  let ownerInvitation = null;
  if (input.owner_email.trim().toLowerCase() !== adminCtx.user.email.trim().toLowerCase()) ownerInvitation = await issueInvite({ email: input.owner_email, role: "admin", interfaceSettings: input.owner_interface_settings, organizationId: tenant.id, orgName: tenant.name, inviterId: adminCtx.user.id, inviterName: adminCtx.user.full_name ?? adminCtx.user.email, requestId, dispatch: tenant.created });
  void audit({ action: "tenant.created_by_platform_admin", actorUserId: adminCtx.user.id, actingAsPlatformAdmin: true, bypassedRls: true, organizationId: tenant.id, resourceType: "organization", resourceId: tenant.id, requestId, metadata: { slug: tenant.slug, created: tenant.created } });
  return ok({ id: tenant.id, slug: tenant.slug, display_name: tenant.name, owner_invitation: ownerInvitation }, { status: tenant.created ? 201 : 200, requestId });
}
