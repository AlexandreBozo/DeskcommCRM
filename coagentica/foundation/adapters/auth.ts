import type { RoleCheck } from "@/lib/auth/require-role";
import {
  createActorContext,
  createTenantContext,
  type ActorContext,
  type PermissionDecision,
  type TenantContext,
} from "../contracts/tenancy";

export interface RoleCheckAdapterOptions {
  readonly correlationId?: string;
  readonly causationId?: string;
  readonly deniedReason?: string;
}

export function adaptRoleCheckToTenantContext(
  check: RoleCheck,
  options: RoleCheckAdapterOptions = {}
): TenantContext | null {
  if (!check.ok) return null;

  return createTenantContext({
    tenantId: check.org.orgId,
    organizationId: check.org.orgId,
    organizationName: check.org.name,
    role: check.org.role,
    visibilityMode: check.org.visibility_mode ?? "own",
    locale: check.user.locale ?? String(check.user.idioma ?? ""),
    timezone: check.user.timezone ?? "UTC",
    isPlatformAdmin: check.user.is_platform_admin,
    actorId: check.user.id,
    actorRole: check.org.role,
    correlationId: options.correlationId,
    causationId: options.causationId,
  });
}

export function adaptRoleCheckToActorContext(
  check: RoleCheck,
  options: RoleCheckAdapterOptions = {}
): ActorContext | null {
  if (!check.ok) return null;
  const tenantContext = adaptRoleCheckToTenantContext(check, options);
  if (tenantContext === null) return null;

  return createActorContext({
    actorId: check.user.id,
    actorType: "human",
    tenantContext,
    correlationId: options.correlationId,
    causationId: options.causationId,
  });
}

export function adaptRoleCheckToPermissionDecision(
  check: RoleCheck,
  options: RoleCheckAdapterOptions = {}
): PermissionDecision {
  if (check.ok) {
    return {
      allow: true,
      reason: "require_role_allowed",
    };
  }

  return {
    allow: false,
    reason: options.deniedReason ?? "require_role_denied",
  };
}
