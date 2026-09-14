import type { PolicyDecision } from "@/coagentica/operations-kernel/contracts/policy";
import type { WorkflowDefinition, WorkflowRun } from "@/coagentica/operations-kernel/contracts/workflow";
import type { EventEnvelope } from "@/coagentica/operations-kernel/contracts/domain-event";

export interface TenantOperationsCore {
  readonly tenantId: string;
  readonly organizationId: string;
  readonly actorContext: ActorContextCore;
  readonly permissions: PermissionCheck[];
  readonly activeWorkflows: WorkflowRun[];
  readonly publishedDefinitions: WorkflowDefinition[];
  readonly eventLog: EventEnvelope[];
  readonly policyDecisions: PolicyDecision[];
}

export interface ActorContextCore {
  readonly actorId: string;
  readonly actorType: string;
  readonly tenantId: string;
  readonly role: string;
  readonly isPlatformAdmin: boolean;
  readonly correlationId?: string;
}

export interface PermissionCheck {
  readonly resource: string;
  readonly action: string;
  readonly decision: "allow" | "deny" | "defer";
  readonly reason: string;
  readonly requiredRole?: string;
}

export function createTenantOperationsCore(params: {
  tenantId: string;
  organizationId: string;
  actorContext: ActorContextCore;
}): TenantOperationsCore {
  if (!params.tenantId || params.tenantId.trim() === "") {
    throw new Error("tenantId é obrigatório");
  }
  if (!params.organizationId || params.organizationId.trim() === "") {
    throw new Error("organizationId é obrigatório");
  }
  if (!params.actorContext.actorId || params.actorContext.actorId.trim() === "") {
    throw new Error("actorContext.actorId é obrigatório");
  }
  return {
    tenantId: params.tenantId,
    organizationId: params.organizationId,
    actorContext: params.actorContext,
    permissions: [],
    activeWorkflows: [],
    publishedDefinitions: [],
    eventLog: [],
    policyDecisions: [],
  };
}

export function addPermission(core: TenantOperationsCore, check: PermissionCheck): TenantOperationsCore {
  return { ...core, permissions: [...core.permissions, check] };
}

export function addWorkflowRun(core: TenantOperationsCore, run: WorkflowRun): TenantOperationsCore {
  return { ...core, activeWorkflows: [...core.activeWorkflows, run] };
}

export function addPolicyDecision(core: TenantOperationsCore, decision: PolicyDecision): TenantOperationsCore {
  return { ...core, policyDecisions: [...core.policyDecisions, decision] };
}

export function addEventEnvelope(core: TenantOperationsCore, envelope: EventEnvelope): TenantOperationsCore {
  return { ...core, eventLog: [...core.eventLog, envelope] };
}

export function isTenantBoundToCore(core: TenantOperationsCore, tenantId: string): boolean {
  return core.tenantId === tenantId;
}

export function validateTenantOperationsCore(core: TenantOperationsCore): readonly string[] {
  const errors: string[] = [];
  if (!core.tenantId || core.tenantId.trim() === "") {
    errors.push("tenantId é obrigatório");
  }
  if (!core.organizationId || core.organizationId.trim() === "") {
    errors.push("organizationId é obrigatório");
  }
  if (!core.actorContext.actorId || core.actorContext.actorId.trim() === "") {
    errors.push("actorContext.actorId é obrigatório");
  }
  return errors;
}
