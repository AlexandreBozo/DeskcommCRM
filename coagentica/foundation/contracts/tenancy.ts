/**
 * Tipos canônicos do domínio — definidos aqui para que foundation (e
 * consequentemente operations-kernel/intelligence) não dependa de `@/lib`.
 * A adaptação dos tipos legados do Deskcomm para estes vive em
 * `operations-kernel/adapters/` ou `foundation/adapters/` (quando existir).
 */

/** Papel do ator dentro de uma organização. Equivalente a `Role` de `lib/auth/types`. */
export type Role = "viewer" | "agent" | "ai_operator" | "manager" | "admin";

/** Modo de visibilidade do ator. Equivalente a `VisibilityMode` de `lib/auth/types`. */
export type VisibilityMode = "all" | "own_and_unassigned" | "own";

/**
 * Ação auditada. Equivalente a `AuditAction` de `lib/audit/actions`.
 * Declarado como `string` porque a union completa tem ~200 literais e
 * o contrato aqui só precisa de compatibilidade estrutural (campo opcional
 * em PermissionDecision).
 */
export type AuditAction = string;

/**
 * Fronteira de tenancy — contrato canônico do Deskcomm.
 *
 * - tenantId é OBRIGATÓRIO: nunca existe operação legítima sem organização.
 * - organizationId é OBRIGATÓRIO no escopo do ecossistema (igual a tenantId
 *   quando a organização É o tenant; difere no legado Multi-org).
 * - role + visibilityMode restringem o alcance (G4-01).
 * - correlationId propaga-se em logs, eventos e respostas para rastreamento
 *   ponta-a-ponta.
 */
export interface TenantContext {
  readonly tenantId: string;
  readonly organizationId: string;
  readonly organizationName: string;
  readonly role: Role;
  readonly visibilityMode: VisibilityMode;
  readonly locale: string;
  readonly timezone: string;
  readonly isPlatformAdmin: boolean;
  readonly actorId?: string;
  readonly actorRole?: Role;
  readonly correlationId?: string;
  readonly causationId?: string;
}

export type ActorType = "human" | "agent" | "system" | "flow" | (string & {});

/**
 * Contexto de ator — o "quem" da operação. ActorContext é a forma enriquecida:
 * opcionalmente carrega `tenantContext` completo (contém todos os campos do
 * tenant) OU a forma plana (tenantId/role/visibilityMode no topo). Para que
 * ambos os estilos coexistam no ecossistema, `actorId` é o único campo
 * obrigatório; todo o resto é opcional e os validators sinalizam o que falta.
 */
export interface ActorContext {
  readonly actorId: string;
  readonly actorType?: ActorType;
  readonly tenantContext: TenantContext;
  readonly correlationId?: string;
  readonly causationId?: string;
  readonly tenantId?: string;
  readonly organizationId?: string;
  readonly organizationName?: string;
  readonly role?: Role;
  readonly visibilityMode?: VisibilityMode;
  readonly locale?: string;
  readonly timezone?: string;
  readonly actorRole?: Role;
  readonly isPlatformAdmin?: boolean;
  readonly mfaVerified?: boolean;
  readonly resourceOwnerId?: string;
  readonly resourceTenantId?: string;
}

/**
 * Compat legado (desktop/antigo): forma plana `{ actorId, role, tenant,
 * tenantId, isPlatformAdmin, mfaVerified, ... }`. Mantida para não quebrar
 * invocações já em assinatura; `createActorContext` normaliza tudo.
 */
export interface LegacyActorContextInput {
  readonly actorId: string;
  readonly role: Role;
  readonly tenant: TenantContext;
  readonly tenantId?: string;
  readonly isPlatformAdmin?: boolean;
  readonly mfaVerified?: boolean;
  readonly correlationId?: string;
  readonly causationId?: string;
}

export interface ActorContextInput {
  readonly actorId: string;
  readonly actorType: ActorType;
  readonly tenantContext: TenantContext;
  readonly correlationId?: string;
  readonly causationId?: string;
}

/**
 * Decisão de permissão — duas grafias coexistem no ecossistema:
 * - forma `{ allow: boolean | "defer" }` (helper de tenancy);
 * - forma `{ kind: "allow" | "deny" | "defer" }` (engine de política).
 */
export type PermissionDecision =
  | { readonly allow: boolean | "defer"; readonly reason: string; readonly retryAt?: string }
  | { readonly kind: "allow"; readonly reason?: string }
  | { readonly kind: "deny"; readonly reason: string; readonly auditAction?: AuditAction }
  | { readonly kind: "defer"; readonly reason: string; readonly retryAt: string };

export interface CreateTenantContextInput {
  readonly tenantId: string;
  readonly organizationId?: string;
  readonly organizationName?: string;
  readonly role?: Role;
  readonly visibilityMode?: VisibilityMode;
  readonly locale?: string;
  readonly timezone?: string;
  readonly isPlatformAdmin?: boolean;
  readonly actorId?: string;
  readonly actorRole?: Role;
  readonly correlationId?: string;
  readonly causationId?: string;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

export function isRole(value: unknown): value is Role {
  return value === "viewer" || value === "agent" || value === "ai_operator" || value === "manager" || value === "admin";
}

function isActorType(value: unknown): value is ActorType {
  return typeof value === "string" && ["human", "agent", "system", "flow"].includes(value);
}

export function createTenantContext(input: CreateTenantContextInput | string): TenantContext {
  if (typeof input === "string") {
    return {
      tenantId: input,
      organizationId: input,
      organizationName: "",
      role: "viewer",
      visibilityMode: "own",
      locale: "",
      timezone: "UTC",
      isPlatformAdmin: false,
    };
  }
  if (!isNonEmptyString(input.tenantId)) {
    throw new Error("tenantId é obrigatório");
  }
  if (!isNonEmptyString(input.organizationId ?? input.tenantId)) {
    throw new Error("organizationId é obrigatório");
  }
  const organizationId = input.organizationId ?? input.tenantId;
  return {
    tenantId: input.tenantId,
    organizationId,
    organizationName: input.organizationName ?? "",
    role: input.role ?? "viewer",
    visibilityMode: input.visibilityMode ?? "own",
    locale: input.locale ?? "",
    timezone: input.timezone ?? "UTC",
    isPlatformAdmin: input.isPlatformAdmin ?? false,
    ...(input.actorId !== undefined && { actorId: input.actorId }),
    ...(input.actorRole !== undefined && { actorRole: input.actorRole }),
    ...(input.correlationId !== undefined && { correlationId: input.correlationId }),
    ...(input.causationId !== undefined && { causationId: input.causationId }),
  };
}

export function createActorContext(input: ActorContextInput): ActorContext;
export function createActorContext(input: LegacyActorContextInput): ActorContext;
export function createActorContext(tenant: TenantContext, extra?: { actorId: string; correlationId?: string }): ActorContext;
export function createActorContext(
  input: ActorContextInput | LegacyActorContextInput | TenantContext,
  extra?: { actorId: string; correlationId?: string }
): ActorContext {
  if ("tenantContext" in input) {
    const actorInput = input as ActorContextInput;
    if (!isNonEmptyString(actorInput.actorId)) {
      throw new Error("actorId é obrigatório");
    }
    if (!isActorType(actorInput.actorType)) {
      throw new Error(`actorType inválido: ${String(actorInput.actorType)}`);
    }
    if (actorInput.correlationId !== undefined && !isNonEmptyString(actorInput.correlationId)) {
      throw new Error("correlationId é obrigatório");
    }
    return {
      actorId: actorInput.actorId,
      actorType: actorInput.actorType,
      tenantContext: actorInput.tenantContext,
      ...(actorInput.correlationId !== undefined && { correlationId: actorInput.correlationId }),
      ...(actorInput.causationId !== undefined && { causationId: actorInput.causationId }),
    };
  }
  if ("role" in input && "tenant" in input) {
    const legacyInput = input as LegacyActorContextInput;
    if (!isNonEmptyString(legacyInput.actorId)) {
      throw new Error("actorId é obrigatório");
    }
    const ctx: ActorContext = {
      actorId: legacyInput.actorId,
      tenantContext: legacyInput.tenant,
      tenantId: legacyInput.tenant.tenantId,
      role: legacyInput.role,
      isPlatformAdmin: legacyInput.isPlatformAdmin ?? false,
      ...(legacyInput.mfaVerified !== undefined && { mfaVerified: legacyInput.mfaVerified }),
      ...(legacyInput.correlationId !== undefined && { correlationId: legacyInput.correlationId }),
      ...(legacyInput.causationId !== undefined && { causationId: legacyInput.causationId }),
    };
    return ctx;
  }
  const tenant = input as TenantContext;
  if (extra === undefined || !isNonEmptyString(extra.actorId)) {
    throw new Error("actorId é obrigatório");
  }
  return {
    actorId: extra.actorId,
    tenantContext: tenant,
    ...(extra.correlationId !== undefined && { correlationId: extra.correlationId }),
  };
}

export function createTenantSession(actor: ActorContext): TenantContext {
  const base = actor.tenantContext;
  if (base !== undefined) {
    return base;
  }
  return {
    tenantId: actor.tenantId ?? "",
    organizationId: actor.organizationId ?? actor.tenantId ?? "",
    organizationName: actor.organizationName ?? "",
    role: actor.role ?? "viewer",
    visibilityMode: actor.visibilityMode ?? "own",
    locale: actor.locale ?? "",
    timezone: actor.timezone ?? "UTC",
    isPlatformAdmin: actor.isPlatformAdmin ?? false,
    ...(actor.actorId !== undefined && { actorId: actor.actorId }),
    ...(actor.actorRole !== undefined && { actorRole: actor.actorRole }),
    ...(actor.correlationId !== undefined && { correlationId: actor.correlationId }),
    ...(actor.causationId !== undefined && { causationId: actor.causationId }),
  };
}

export function validateTenantContext(ctx: TenantContext): readonly string[] {
  const errors: string[] = [];
  if (!isNonEmptyString(ctx.tenantId)) {
    errors.push("tenantId é obrigatório");
  }
  if (!isNonEmptyString(ctx.organizationId)) {
    errors.push("organizationId é obrigatório");
  }
  if (!isNonEmptyString(ctx.organizationName)) {
    errors.push("organizationName é obrigatório");
  }
  if (!["viewer", "agent", "ai_operator", "manager", "admin"].includes(ctx.role)) {
    errors.push("role inválido");
  }
  if (!["own", "own_and_unassigned", "team", "org"].includes(ctx.visibilityMode)) {
    errors.push("visibilityMode inválido");
  }
  if (!isNonEmptyString(ctx.locale)) {
    errors.push("locale é obrigatório");
  }
  if (!isNonEmptyString(ctx.timezone)) {
    errors.push("timezone é obrigatório");
  }
  return errors;
}

export function validateActorContext(actor: ActorContext): readonly string[] {
  const errors: string[] = [];
  if (!isNonEmptyString(actor.actorId)) {
    errors.push("actorId é obrigatório");
  }
  if (actor.actorType !== undefined && !isActorType(actor.actorType)) {
    errors.push(`actorType inválido: ${String(actor.actorType)}`);
  }
  if (actor.correlationId !== undefined && !isNonEmptyString(actor.correlationId)) {
    errors.push("correlationId é obrigatório");
  }
  errors.push(...validateTenantContext(actor.tenantContext));
  return errors;
}

export function isPermissionAllowed(decision: PermissionDecision): boolean {
  if ("allow" in decision) {
    return decision.allow === true;
  }
  return decision.kind === "allow";
}

export function isPermissionDenied(decision: PermissionDecision): boolean {
  if ("allow" in decision) {
    return decision.allow === false;
  }
  return decision.kind === "deny";
}

export function isPermissionDeferred(decision: PermissionDecision): boolean {
  if ("allow" in decision) {
    return decision.allow === "defer";
  }
  return decision.kind === "defer";
}

export function decideByRole(actorRole: Role, minimumRole: Role): PermissionDecision {
  const hierarchy: readonly Role[] = ["viewer", "agent", "ai_operator", "manager", "admin"];
  const actorIndex = hierarchy.indexOf(actorRole);
  const minIndex = hierarchy.indexOf(minimumRole);
  if (minIndex === -1 || actorIndex === -1 || actorIndex < minIndex) {
    return { allow: false, reason: `papel insuficiente — exige ${minimumRole}` };
  }
  return { allow: true, reason: `papel atende: ${actorRole}` };
}

export function decideByOwnership(actorContext: ActorContext, resourceOwnerId: string | undefined): PermissionDecision {
  if (actorContext.isPlatformAdmin === true) {
    return { allow: true, reason: "admin de plataforma acessa qualquer recurso" };
  }
  if (actorContext.actorId !== "" && resourceOwnerId !== undefined && actorContext.actorId === resourceOwnerId) {
    return { allow: true, reason: "dono do recurso" };
  }
  if (actorContext.actorId !== "" && resourceOwnerId === undefined) {
    return { allow: true, reason: "recurso não possui dono — acesso permitido" };
  }
  return { allow: false, reason: "não é dono do recurso" };
}

export function decidePlatformAdmin(actorContext: ActorContext): PermissionDecision {
  if (actorContext.isPlatformAdmin === true) {
    return { allow: true, reason: "admin de plataforma" };
  }
  return { allow: false, reason: "não é admin de plataforma" };
}

function denyDecisionData(decision: PermissionDecision): { reason: string } | null {
  if ("kind" in decision) {
    return decision.kind === "deny" ? { reason: decision.reason } : null;
  }
  return decision.allow === false ? { reason: decision.reason } : null;
}

function deferDecisionData(decision: PermissionDecision): { reason: string; retryAt?: string } | null {
  if ("kind" in decision) {
    return decision.kind === "defer" ? { reason: decision.reason, retryAt: decision.retryAt } : null;
  }
  if (decision.allow === "defer") {
    return { reason: decision.reason, ...(decision.retryAt !== undefined && { retryAt: decision.retryAt }) };
  }
  return null;
}

export function combineDecisions(decisions: readonly PermissionDecision[]): PermissionDecision {
  if (decisions.length === 0) {
    return { allow: false, reason: "nenhuma decisão" };
  }
  for (const decision of decisions) {
    const denied = denyDecisionData(decision);
    if (denied !== null) {
      return { allow: false, reason: denied.reason };
    }
  }
  for (const decision of decisions) {
    const deferred = deferDecisionData(decision);
    if (deferred !== null) {
      return { allow: "defer", reason: deferred.reason, ...(deferred.retryAt !== undefined && { retryAt: deferred.retryAt }) };
    }
  }
  return { allow: true, reason: "todas as decisões permitem" };
}

export function isValidTenantContext(ctx: unknown): ctx is TenantContext {
  return (
    typeof ctx === "object" &&
    ctx !== null &&
    "tenantId" in (ctx as object) &&
    isNonEmptyString((ctx as { tenantId: unknown }).tenantId)
  );
}

export function isValidActorContext(ctx: unknown): ctx is ActorContext {
  return (
    typeof ctx === "object" &&
    ctx !== null &&
    "actorId" in (ctx as object) &&
    isNonEmptyString((ctx as { actorId: unknown }).actorId)
  );
}

function isNonEmptyString2(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

export function isTenantId(value: unknown): value is string {
  return isNonEmptyString2(value);
}