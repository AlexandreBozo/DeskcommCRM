import type {
  CapabilityInvocation,
  DecisionRecord,
  IntelligenceRequest,
  PolicyConstraint,
} from "./contracts";
import { createLearningObservation } from "./contracts/learning";
import { validateExecutionPlan, type ExecutionPlan } from "./contracts/planning";
import type { CapabilityExecutorPort } from "./ports/capability-executor-port";
import type { DecisionStorePort } from "./ports/decision-store-port";
import type { LearningPort } from "./ports/learning-port";
import type { PlanningPort } from "./ports/planning-port";
import type { PolicyGatePort, PolicyGateResult } from "./ports/policy-gate-port";
import type {
  TenantOperationalContextPort,
  TenantOperationalContextView,
} from "./ports/tenant-operational-context-port";

/**
 * Runtime nativo da Intelligence (v0.5) — puro, só portas.
 *
 * Ordem canônica (falha fechada):
 *
 * 1. valida a fronteira de tenant (mismatch = deny);
 * 2. autoriza no gate de política ANTES de qualquer leitura operacional
 *    (`request.policyDecision` do caller NUNCA desvia do gate);
 * 3. deny/defer do gate = deny/defer, sem ler contexto e sem executar;
 * 4. falha do gate (throw) ou decisão desconhecida = defer;
 * 5. allow SEM seleção autorizada = pula a leitura de contexto;
 * 6. allow COM seleção = carrega contexto; falha de carga = defer;
 * 7. persiste autorização write-ahead antes de planejamento/execução;
 * 8. planeja via PlanningPort e revalida tenant/actor/capability/input;
 * 9. executa via porta de executor; falha do executor = escalate;
 * 10. persiste TODO DecisionRecord resultante via porta de store.
 *
 * Este módulo NÃO importa adapters, tenant-runtime, operations-kernel,
 * Deskcomm, Supabase ou SDKs de IA. Hash e relógio são injetados.
 */

export interface IntelligenceRuntimeDeps {
  readonly policyGate: PolicyGatePort;
  readonly operationalContext: TenantOperationalContextPort;
  readonly planner: PlanningPort;
  readonly learning: LearningPort;
  readonly executor: CapabilityExecutorPort;
  readonly store: DecisionStorePort;
  readonly hashValue: (value: unknown) => string;
  readonly now: () => string;
}

export interface IntelligenceRuntimeResult {
  readonly decision: DecisionRecord;
  readonly invocation: CapabilityInvocation | null;
  readonly context: TenantOperationalContextView | null;
}

export class InvalidIntelligenceRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidIntelligenceRequestError";
  }
}

export class DecisionPersistenceError extends Error {
  readonly record: DecisionRecord;
  readonly phase: "authorization" | "outcome";
  readonly invocation: CapabilityInvocation | null;
  readonly originalError: unknown;

  constructor(params: {
    record: DecisionRecord;
    phase: "authorization" | "outcome";
    invocation?: CapabilityInvocation | null;
    originalError: unknown;
  }) {
    super(`falha ao persistir decisão na fase ${params.phase}`);
    this.name = "DecisionPersistenceError";
    this.record = params.record;
    this.phase = params.phase;
    this.invocation = params.invocation ?? null;
    this.originalError = params.originalError;
  }
}

function resolveCorrelationId(request: IntelligenceRequest): string {
  const fromActor = request.actorContext.correlationId;
  if (fromActor !== undefined && fromActor.trim() !== "") return fromActor;
  const fromTenant = request.tenantContext.correlationId;
  if (fromTenant !== undefined && fromTenant.trim() !== "") return fromTenant;
  return request.requestId;
}

function isNonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

function readTenantBoundary(request: IntelligenceRequest): {
  tenantId: string;
  organizationId: string;
  actorTenantId: string;
  actorOrganizationId: string;
} {
  const tenantContext = request?.tenantContext;
  const actorContext = request?.actorContext;
  const actorTenantContext = actorContext?.tenantContext;

  if (
    !request ||
    !isNonEmpty(request.requestId) ||
    !isNonEmpty(request.capability) ||
    !tenantContext ||
    !actorContext ||
    !isNonEmpty(actorContext.actorId)
  ) {
    throw new InvalidIntelligenceRequestError("request de intelligence sem identidade canônica");
  }

  return {
    tenantId: tenantContext.tenantId ?? "",
    organizationId: tenantContext.organizationId ?? "",
    actorTenantId: actorTenantContext?.tenantId ?? "",
    actorOrganizationId: actorTenantContext?.organizationId ?? "",
  };
}

function buildDecisionRecord(params: {
  request: IntelligenceRequest;
  decision: DecisionRecord["decision"];
  reason: string;
  inputHash: string;
  outputHash?: string;
  policyDecision?: PolicyConstraint;
  timestamp: string;
  decisionId?: string;
  metadata?: Record<string, unknown>;
}): DecisionRecord {
  const correlationId = resolveCorrelationId(params.request);
  return {
    decisionId: params.decisionId ?? `${params.request.requestId}-decision`,
    tenantId: params.request.tenantContext.tenantId,
    actorId: params.request.actorContext.actorId,
    correlationId,
    capability: params.request.capability,
    decision: params.decision,
    reason: params.reason,
    inputHash: params.inputHash,
    ...(params.outputHash !== undefined && { outputHash: params.outputHash }),
    ...(params.policyDecision !== undefined && {
      policyDecision: params.policyDecision,
    }),
    timestamp: params.timestamp,
    metadata: { requestId: params.request.requestId, ...(params.metadata ?? {}) },
  };
}

async function persistDecision(
  deps: IntelligenceRuntimeDeps,
  record: DecisionRecord,
  phase: "authorization" | "outcome",
  invocation?: CapabilityInvocation | null
): Promise<DecisionRecord> {
  try {
    return await deps.store.saveDecision(record);
  } catch (originalError) {
    throw new DecisionPersistenceError({
      record,
      phase,
      invocation,
      originalError,
    });
  }
}

async function persistOutcome(
  deps: IntelligenceRuntimeDeps,
  request: IntelligenceRequest,
  record: DecisionRecord,
  invocation?: CapabilityInvocation | null
): Promise<DecisionRecord> {
  const persisted = await persistDecision(deps, record, "outcome", invocation);
  try {
    await deps.learning.observe(
      createLearningObservation({
        request,
        decision: persisted,
        observedAt: deps.now(),
      })
    );
  } catch {
    // Learning v0.11 é estritamente observacional e não invalida o outcome durável.
  }
  return persisted;
}

function assertOperationalContextBoundary(
  context: TenantOperationalContextView,
  tenantId: string,
  organizationId: string
): void {
  if (
    context.tenantId !== tenantId ||
    context.organizationId !== organizationId ||
    organizationId !== tenantId
  ) {
    throw new Error("contexto operacional pertence a outro tenant");
  }
}

function buildPendingInvocation(
  request: IntelligenceRequest,
  startedAt: string,
  plan: ExecutionPlan
): CapabilityInvocation {
  const step = plan.steps[0]!;
  return {
    invocationId: `${request.requestId}-invocation`,
    capability: step.capability,
    input: step.input,
    status: "pending",
    startedAt,
    metadata: {
      planId: plan.planId,
      stepId: step.stepId,
      planningStrategy: plan.strategy,
    },
    actorContext: request.actorContext,
  };
}

export async function runIntelligence(
  request: IntelligenceRequest,
  deps: IntelligenceRuntimeDeps
): Promise<IntelligenceRuntimeResult> {
  const { tenantId, organizationId, actorTenantId, actorOrganizationId } =
    readTenantBoundary(request);
  const timestamp = deps.now();
  const inputHash = deps.hashValue(request.input);

  // 1. Fronteira de tenant — mismatch = deny, sem tocar em gate/contexto/executor.
  if (
    !isNonEmpty(tenantId) ||
    !isNonEmpty(organizationId) ||
    !isNonEmpty(actorTenantId) ||
    !isNonEmpty(actorOrganizationId) ||
    tenantId !== organizationId ||
    tenantId !== actorTenantId ||
    organizationId !== actorOrganizationId
  ) {
    const decision = buildDecisionRecord({
      request,
      decision: "deny",
      reason: "fronteira de tenant violada",
      inputHash,
      timestamp,
    });
    const persisted = await persistOutcome(deps, request, decision);
    return { decision: persisted, invocation: null, context: null };
  }

  // 2. Gate de política ANTES de qualquer leitura operacional.
  // request.policyDecision do caller nunca desvia do gate de propósito.
  let gate: PolicyGateResult;
  try {
    gate = await deps.policyGate.authorize(request);
  } catch {
    const decision = buildDecisionRecord({
      request,
      decision: "defer",
      reason: "falha da política — defer por falha fechada",
      inputHash,
      timestamp,
    });
    const persisted = await persistOutcome(deps, request, decision);
    return { decision: persisted, invocation: null, context: null };
  }

  const constraint = gate.constraint;
  if (constraint.decision === "deny") {
    const decision = buildDecisionRecord({
      request,
      decision: "deny",
      reason: constraint.reason,
      inputHash,
      policyDecision: constraint,
      timestamp,
    });
    const persisted = await persistOutcome(deps, request, decision);
    return { decision: persisted, invocation: null, context: null };
  }

  if (constraint.decision === "defer") {
    const decision = buildDecisionRecord({
      request,
      decision: "defer",
      reason: constraint.reason,
      inputHash,
      policyDecision: constraint,
      timestamp,
    });
    const persisted = await persistOutcome(deps, request, decision);
    return { decision: persisted, invocation: null, context: null };
  }

  if (constraint.decision !== "allow") {
    const decision = buildDecisionRecord({
      request,
      decision: "defer",
      reason: "decisão de política desconhecida — defer por falha fechada",
      inputHash,
      timestamp,
    });
    const persisted = await persistOutcome(deps, request, decision);
    return { decision: persisted, invocation: null, context: null };
  }

  // 3. Allow: carrega contexto SOMENTE com seleção autorizada.
  let context: TenantOperationalContextView | null = null;
  if (gate.selection !== undefined) {
    try {
      context = await deps.operationalContext.loadOperationalContext({
        tenantContext: request.tenantContext,
        selection: gate.selection,
        ...(gate.limits !== undefined && { limits: gate.limits }),
      });
      assertOperationalContextBoundary(context, tenantId, organizationId);
    } catch {
      const decision = buildDecisionRecord({
        request,
        decision: "defer",
        reason: "falha ao carregar contexto operacional — defer por falha fechada",
        inputHash,
        policyDecision: constraint,
        timestamp,
      });
      const persisted = await persistOutcome(deps, request, decision);
      return { decision: persisted, invocation: null, context: null };
    }
  }

  // 4. Write-ahead: autorização precisa estar durável antes de qualquer executor com side effect.
  const authorization = buildDecisionRecord({
    request,
    decision: "allow",
    reason: constraint.reason,
    inputHash,
    policyDecision: constraint,
    timestamp,
    decisionId: `${request.requestId}-authorization`,
    metadata: { phase: "authorization" },
  });
  await persistDecision(deps, authorization, "authorization");

  // 5. Planejamento ocorre depois da autorização durável. Nesta fase (v0.9),
  // o plano precisa ser direct/1-step e exatamente equivalente ao request.
  let plan: ExecutionPlan;
  try {
    plan = await deps.planner.plan({ request, context });
    const planErrors = validateExecutionPlan(plan, request);
    const step = plan.steps[0];
    if (
      planErrors.length > 0 ||
      step === undefined ||
      deps.hashValue(step.input) !== inputHash
    ) {
      throw new Error("plano inválido");
    }
  } catch {
    const decision = buildDecisionRecord({
      request,
      decision: "defer",
      reason: "falha ao planejar execução — defer por falha fechada",
      inputHash,
      policyDecision: constraint,
      timestamp,
      metadata: { phase: "planning" },
    });
    const persisted = await persistOutcome(deps, request, decision);
    return { decision: persisted, invocation: null, context };
  }

  // 6. Executa via porta — falha = escalate.
  const invocation = buildPendingInvocation(request, timestamp, plan);
  let executed: CapabilityInvocation;
  try {
    executed = await deps.executor.execute({ request, invocation, context });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "erro desconhecido";
    const decision = buildDecisionRecord({
      request,
      decision: "escalate",
      reason: `falha do executor — escalado por falha fechada: ${detail}`,
      inputHash,
      policyDecision: constraint,
      timestamp,
      metadata: {
        planId: plan.planId,
        stepId: plan.steps[0]!.stepId,
        planningStrategy: plan.strategy,
      },
    });
    const persisted = await persistOutcome(deps, request, decision, invocation);
    return { decision: persisted, invocation, context };
  }

  if (executed.status !== "completed") {
    const decision = buildDecisionRecord({
      request,
      decision: "escalate",
      reason: `executor retornou ${executed.status} — escalado por falha fechada`,
      inputHash,
      ...(executed.output !== undefined && {
        outputHash: deps.hashValue(executed.output),
      }),
      policyDecision: constraint,
      timestamp,
      metadata: {
        planId: plan.planId,
        stepId: plan.steps[0]!.stepId,
        planningStrategy: plan.strategy,
      },
    });
    const persisted = await persistOutcome(deps, request, decision, executed);
    return { decision: persisted, invocation: executed, context };
  }

  const decision = buildDecisionRecord({
    request,
    decision: "allow",
    reason: constraint.reason,
    inputHash,
    ...(executed.output !== undefined && {
      outputHash: deps.hashValue(executed.output),
    }),
    policyDecision: constraint,
    timestamp,
    metadata: {
      planId: plan.planId,
      stepId: plan.steps[0]!.stepId,
      planningStrategy: plan.strategy,
    },
  });
  const persisted = await persistOutcome(deps, request, decision, executed);
  return { decision: persisted, invocation: executed, context };
}
