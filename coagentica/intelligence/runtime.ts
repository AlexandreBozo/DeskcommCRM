import type {
  CapabilityInvocation,
  DecisionRecord,
  IntelligenceRequest,
  PolicyConstraint,
} from "./contracts";
import { createLearningObservation } from "./contracts/learning";
import { validateExecutionPlan, type ExecutionPlan, type ExecutionPlanStep } from "./contracts/planning";
import type { CapabilityExecutorPort } from "./ports/capability-executor-port";
import type { ContextEnginePort } from "./ports/context-engine-port";
import type { GovernancePort } from "./ports/governance-port";
import type { DecisionStorePort } from "./ports/decision-store-port";
import type { LearningPort } from "./ports/learning-port";
import type { MemoryPort } from "./ports/memory-port";
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
  readonly memory: MemoryPort;
  readonly contextEngine: ContextEnginePort;
  readonly governance: GovernancePort;
  readonly learning: LearningPort;
  readonly executor: CapabilityExecutorPort;
  readonly store: DecisionStorePort;
  readonly hashValue: (value: unknown) => string;
  readonly now: () => string;
}

export interface IntelligenceRuntimeResult {
  readonly decision: DecisionRecord;
  readonly invocation: CapabilityInvocation | null;
  readonly invocations?: readonly CapabilityInvocation[];
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
  plan: ExecutionPlan,
  step: ExecutionPlanStep,
  stepIndex: number
): CapabilityInvocation {
  return {
    invocationId: plan.steps.length === 1
      ? `${request.requestId}-invocation`
      : `${request.requestId}-invocation-${stepIndex + 1}`,
    capability: step.capability,
    input: step.input,
    status: "pending",
    startedAt,
    metadata: {
      planId: plan.planId,
      stepId: step.stepId,
      planningStrategy: plan.strategy,
      planStepIndex: stepIndex,
      planStepCount: plan.steps.length,
      ...step.metadata,
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

  // 4. Memory v0.12: projeta somente working memory ativa, limitada e tenant-bound.
  let memorySelectedCount = 0;
  let memoryTruncated = false;
  if (context !== null) {
    try {
      const preparedMemory = await deps.memory.prepare({ tenantId, context });
      context = preparedMemory.context;
      memorySelectedCount = preparedMemory.selectedCount;
      memoryTruncated = preparedMemory.truncated;
    } catch {
      const decision = buildDecisionRecord({
        request,
        decision: "defer",
        reason: "falha ao preparar memória operacional — defer por falha fechada",
        inputHash,
        policyDecision: constraint,
        timestamp,
        metadata: { phase: "memory", memoryVersion: "v0.12" },
      });
      const persisted = await persistOutcome(deps, request, decision);
      return { decision: persisted, invocation: null, context };
    }
  }

  // 5. Context Engine v0.15: reduz o contexto por relevância e orçamento antes do planning.
  let contextTruncated = false;
  let contextSelected = {
    entities: 0,
    relationships: 0,
    knowledgeSources: 0,
    memoryEntries: memorySelectedCount,
    goals: 0,
    capabilities: 0,
  };
  try {
    const preparedContext = await deps.contextEngine.prepare({ request, context });
    context = preparedContext.context;
    contextTruncated = preparedContext.truncated;
    contextSelected = preparedContext.selected;
  } catch {
    const decision = buildDecisionRecord({
      request,
      decision: "defer",
      reason: "falha ao preparar contexto relevante — defer por falha fechada",
      inputHash,
      policyDecision: constraint,
      timestamp,
      metadata: { phase: "context-engine", contextEngineVersion: "v0.15" },
    });
    const persisted = await persistOutcome(deps, request, decision);
    return { decision: persisted, invocation: null, context };
  }

  // 6. Write-ahead: autorização fica durável antes de planning/governança/executor.
  const authorization = buildDecisionRecord({
    request,
    decision: "allow",
    reason: constraint.reason,
    inputHash,
    policyDecision: constraint,
    timestamp,
    decisionId: `${request.requestId}-authorization`,
    metadata: {
      phase: "authorization",
      goalsVersion: "v0.13",
      activeGoals: contextSelected.goals,
      memoryVersion: "v0.12",
      memoryMode: "read-only",
      workingMemoryEntries: contextSelected.memoryEntries,
      memoryTruncated,
      contextEngineVersion: "v0.15",
      contextTruncated,
      contextSelected,
    },
  });
  await persistDecision(deps, authorization, "authorization");

  // 7. Planning v0.14/v0.16: goal-aware, no máximo três passos e primeiro passo equivalente ao request.
  let plan: ExecutionPlan;
  try {
    plan = await deps.planner.plan({ request, context });
    const planErrors = validateExecutionPlan(plan, request);
    const firstStep = plan.steps[0];
    if (
      planErrors.length > 0 ||
      firstStep === undefined ||
      deps.hashValue(firstStep.input) !== inputHash
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

  // 8. Governance v0.19 + Agent Runtime v0.17: cada passo é avaliado antes da execução.
  const executions: CapabilityInvocation[] = [];
  for (const [stepIndex, step] of plan.steps.entries()) {
    let governance;
    try {
      governance = await deps.governance.assess({ request, step, context });
    } catch {
      const decision = buildDecisionRecord({
        request,
        decision: "defer",
        reason: "falha ao avaliar governança — defer por falha fechada",
        inputHash,
        policyDecision: constraint,
        timestamp,
        metadata: { phase: "governance", governanceVersion: "v0.19", stepId: step.stepId },
      });
      const persisted = await persistOutcome(deps, request, decision, executions.at(-1) ?? null);
      return { decision: persisted, invocation: executions.at(-1) ?? null, invocations: executions, context };
    }

    if (governance.decision !== "allow") {
      const approvalRequired = governance.decision === "approval_required";
      const decision = buildDecisionRecord({
        request,
        decision: approvalRequired ? "defer" : "deny",
        reason: governance.reason,
        inputHash,
        policyDecision: constraint,
        timestamp,
        metadata: {
          phase: "governance",
          governanceVersion: governance.version,
          approvalRequired,
          sideEffect: governance.action.sideEffect,
          stepId: step.stepId,
        },
      });
      const persisted = await persistOutcome(deps, request, decision, executions.at(-1) ?? null);
      return { decision: persisted, invocation: executions.at(-1) ?? null, invocations: executions, context };
    }

    const invocation = buildPendingInvocation(request, timestamp, plan, step, stepIndex);
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
          stepId: step.stepId,
          planStepIndex: stepIndex,
          planStepCount: plan.steps.length,
          planningStrategy: plan.strategy,
          governanceVersion: governance.version,
        },
      });
      const persisted = await persistOutcome(deps, request, decision, invocation);
      return { decision: persisted, invocation, invocations: [...executions, invocation], context };
    }

    executions.push(executed);
    if (executed.status !== "completed") {
      const decision = buildDecisionRecord({
        request,
        decision: "escalate",
        reason: `executor retornou ${executed.status} — escalado por falha fechada`,
        inputHash,
        ...(executed.output !== undefined && { outputHash: deps.hashValue(executed.output) }),
        policyDecision: constraint,
        timestamp,
        metadata: {
          planId: plan.planId,
          stepId: step.stepId,
          planStepIndex: stepIndex,
          planStepCount: plan.steps.length,
          planningStrategy: plan.strategy,
          governanceVersion: governance.version,
        },
      });
      const persisted = await persistOutcome(deps, request, decision, executed);
      return { decision: persisted, invocation: executed, invocations: executions, context };
    }
  }

  const executed = executions.at(-1)!;
  const decision = buildDecisionRecord({
    request,
    decision: "allow",
    reason: constraint.reason,
    inputHash,
    ...(executed.output !== undefined && { outputHash: deps.hashValue(executed.output) }),
    policyDecision: constraint,
    timestamp,
    metadata: {
      planId: plan.planId,
      stepId: plan.steps.at(-1)!.stepId,
      planningStrategy: plan.strategy,
      planSteps: plan.steps.length,
      executedSteps: executions.length,
      planningVersion: plan.metadata.version,
      primaryGoalId: plan.metadata.primaryGoalId,
      contextEngineVersion: "v0.15",
      governanceVersion: "v0.19",
      agentRuntimeVersion: "v0.17",
    },
  });
  const persisted = await persistOutcome(deps, request, decision, executed);
  return { decision: persisted, invocation: executed, invocations: executions, context };
}
