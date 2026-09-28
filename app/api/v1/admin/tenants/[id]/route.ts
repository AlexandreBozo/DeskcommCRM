import { type NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";

import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { createAdminClient } from "@/lib/supabase/admin";
import { type CanonicalFrom } from "@/lib/supabase/canonical-query";
import { ok, fail } from "@/lib/api/wrappers";
import { audit } from "@/lib/audit";

const patchSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().min(2).max(40).regex(/^[a-z0-9-]+$/),
});
const deleteSchema = z.object({ confirm_name: z.string().trim().min(1) });

async function platformContext() {
  try { return await requirePlatformAdmin(); }
  catch { return null; }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const requestId = randomUUID();
  const { id } = await params;
  const adminCtx = await platformContext();
  if (!adminCtx) return fail("forbidden", "Platform admin required", 403, { requestId });
  const admin = createAdminClient();
  const canonicalFrom = admin.from.bind(admin) as unknown as CanonicalFrom;
  const { data: org, error: orgError } = await canonicalFrom("organizations")
    .select("id, name, slug, status, primary_domain, subdomain, metadata, created_at, updated_at")
    .eq("id", id).is("deleted_at", null).single();
  if (orgError || !org) return fail("not_found", "Tenant not found", 404, { requestId });
  const [usersRes, conversationsRes, messagesRes, leadsRes, ordersRes, lgpdRes, aiRes, wahaRes, integrationRes] = await Promise.all([
    canonicalFrom("organization_members").select("*", { count: "exact", head: true }).eq("organization_id", id).eq("status", "active").is("deleted_at", null),
    admin.from("conversations").select("*", { count: "exact", head: true }).eq("organization_id", id),
    admin.from("messages").select("*", { count: "exact", head: true }).eq("organization_id", id),
    admin.from("crm_leads").select("*", { count: "exact", head: true }).eq("organization_id", id),
    admin.from("orders").select("*", { count: "exact", head: true }).eq("organization_id", id),
    admin.from("lgpd_requests").select("*", { count: "exact", head: true }).eq("organization_id", id).not("status", "in", "(completed,failed)"),
    admin.from("llm_calls").select("*", { count: "exact", head: true }).eq("organization_id", id).gte("created_at", new Date(Date.now() - 30 * 86400000).toISOString()),
    admin.from("channel_sessions").select("*", { count: "exact", head: true }).eq("organization_id", id),
    admin.from("tenant_integrations").select("id, provider, status, created_at").eq("organization_id", id).eq("provider", "nuvemshop").limit(1),
  ]);
  const integration = integrationRes.data?.[0] ?? null;
  const organization = { ...org, display_name: org.name, settings: org.metadata, legal_name: (org.metadata as Record<string, unknown> | null)?.legal_name ?? null, cnpj: (org.metadata as Record<string, unknown> | null)?.cnpj ?? null, onboarded_at: null, suspended_at: null };
  void audit({ action: "platform_admin.tenant_viewed", actorUserId: adminCtx.user.id, actingAsPlatformAdmin: true, bypassedRls: true, organizationId: id, resourceType: "organization", resourceId: id, requestId, metadata: { tenant_slug: org.slug } });
  return ok({ organization, counts: { user_count: usersRes.count ?? 0, conversations_count: conversationsRes.count ?? 0, messages_count: messagesRes.count ?? 0, leads_count: leadsRes.count ?? 0, orders_count: ordersRes.count ?? 0, lgpd_requests_pending: lgpdRes.count ?? 0, ai_invocations_30d: aiRes.count ?? 0, waha_sessions_count: wahaRes.count ?? 0 }, integrations: { nuvemshop_status: integration?.status ?? null, nuvemshop_connected_at: integration?.created_at ?? null } }, { requestId });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const requestId = randomUUID(); const { id } = await params; const adminCtx = await platformContext();
  if (!adminCtx) return fail("forbidden", "Platform admin required", 403, { requestId });
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("validation_error", "Nome ou slug inválido.", 400, { requestId, details: parsed.error.flatten() });
  const admin = createAdminClient();
  const { data, error } = await admin.from("organizations").update({ name: parsed.data.name, slug: parsed.data.slug, updated_by: adminCtx.user.id }).eq("id", id).is("deleted_at", null).select("id, name, slug").maybeSingle();
  if (error) return fail(error.code === "23505" ? "conflict" : "internal_error", error.message, error.code === "23505" ? 409 : 500, { requestId });
  if (!data) return fail("not_found", "Tenant not found", 404, { requestId });
  void audit({ action: "tenant.updated_by_platform_admin", actorUserId: adminCtx.user.id, actingAsPlatformAdmin: true, bypassedRls: true, organizationId: id, resourceType: "organization", resourceId: id, requestId, metadata: { slug: data.slug } });
  return ok({ id: data.id, display_name: data.name, slug: data.slug }, { requestId });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const requestId = randomUUID(); const { id } = await params; const adminCtx = await platformContext();
  if (!adminCtx) return fail("forbidden", "Platform admin required", 403, { requestId });
  const parsed = deleteSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("validation_error", "Confirmação inválida.", 400, { requestId });
  const admin = createAdminClient();
  const { data: org, error: readError } = await admin.from("organizations").select("id, name, slug").eq("id", id).is("deleted_at", null).maybeSingle();
  if (readError || !org) return fail("not_found", "Tenant not found", 404, { requestId });
  if (parsed.data.confirm_name !== org.name) return fail("validation_error", "Digite o nome exato do tenant para confirmar.", 400, { requestId });
  const now = new Date().toISOString();
  const { error } = await admin.from("organizations").update({ status: "archived", deleted_at: now, updated_by: adminCtx.user.id }).eq("id", id);
  if (error) return fail("internal_error", error.message, 500, { requestId });
  void audit({ action: "tenant.archived_by_platform_admin", actorUserId: adminCtx.user.id, actingAsPlatformAdmin: true, bypassedRls: true, organizationId: id, resourceType: "organization", resourceId: id, requestId, metadata: { slug: org.slug } });
  return ok({ id, archived_at: now }, { requestId });
}
