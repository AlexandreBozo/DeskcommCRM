import { describe, expect, it, vi } from "vitest";
import {
  createActorContext,
  createTenantContext,
} from "@/coagentica/foundation/contracts/tenancy";
import {
  createIntelligenceRequest,
  type DecisionRecord,
  type IntelligenceRequest,
} from "@/coagentica/intelligence/contracts";
import type { CapabilityExecutorPort, CapabilityExecuteInput } from "@/coagentica/intelligence/ports/capability-executor-port";
import type { DecisionStorePort } from "@/coagentica/intelligence/ports/decision-store-port";
import type { LearningPort } from "@/coagentica/intelligence/ports/learning-port";
import type { MemoryPort } from "@/coagentica/intelligence/ports/memory-port";
import type { PlanningPort } from "@/coagentica/intelligence/ports/planning-port";
import type { PolicyGatePort } from "@/coagentica/intelligence/ports/policy-gate-port";
import type { TenantOperationalContextPort } from "@/coagentica/intelligence/ports/tenant-operational-context-port";
import type { CapabilityInvocation } from "@/coagentica/intelligence/contracts";
import {
  DecisionPersistenceError,
  InvalidIntelligenceRequestError,
  runIntelligence,
  type IntelligenceRuntimeDeps,
} from "@/coagentica/intelligence/runtime";

const NOW = "2026-09-14T00:00:00.000Z";

const tenantContext = createTenantContext({
  tenantId: "tenant-1",
  organizationId: "tenant-1",
  organizationName: "Org 1",
  role: "agent",
  visibilityMode: "own",
  locale: "pt-BR",
  timezone: "America/Sao_Paulo",
  isPlatformAdmin: false,
});
const actorContext = createActorContext({
  actorId: "actor-1",
  actorType: "human",
  tenantContext,
  correlationId: "corr-1",
});

function makeRequest(
  overrides?: Partial<{ requestId: string; capability: string; input: Record<string, unknown> }>,
  policyDecision?: IntelligenceRequest["policyDecision"]
): IntelligenceRequest {
  return createIntelligenceRequest({
    requestId: overrides?.requestId ?? "req-1",
    tenantContext,
    actorContext,
    capability: overrides?.capability ?? "responder_lead",
    input: overrides?.input ?? { mensagem: "oi" },
    ...(policyDecision !== undefined && { policyDecision }),
  });
}

function emptyView(tenantId = "tenant-1") {
  return {
    tenantId,
    organizationId: tenantId,
    sourceVersion: 1,
    snapshotAt: NOW,
    entities: [],
    relationships: [],
    knowledgeSources: [],
    memoryEntries: [],
    goals: [],
    capabilities: [],
    truncated: {
      entities: false,
      relationships: false,
      knowledgeSources: false,
      memoryEntries: false,
      goals: false,
      capabilities: false,
    },
  };
}

function makeDeps(overrides?: Partial<IntelligenceRuntimeDeps>): {
  deps: IntelligenceRuntimeDeps;
  policyGate: PolicyGatePort & { authorize: ReturnType<typeof vi.fn> };
  operationalContext: TenantOperationalContextPort & {
    loadOperationalContext: ReturnType<typeof vi.fn>;
  };
  planner: PlanningPort & { plan: ReturnType<typeof vi.fn> };
  memory: MemoryPort & { prepare: ReturnType<typeof vi.fn> };
  learning: LearningPort & { observe: ReturnType<typeof vi.fn> };
  executor: CapabilityExecutorPort & { execute: ReturnType<typeof vi.fn> };
  store: DecisionStorePort & { saveDecision: ReturnType<typeof vi.fn> };
  hashValue: ReturnType<typeof vi.fn>;
} {
  const hashValue = vi.fn((value: unknown) => `hash:${JSON.stringify(value)}`);
  const now = vi.fn(() => NOW);
  const policyGate = {
    authorize: vi.fn(async () => ({
      constraint: { decision: "allow" as const, reason: "ok" },
    })),
  };
  const operationalContext = {
    loadOperationalContext: vi.fn(async () => emptyView()),
  };
  const planner = {
    plan: vi.fn(async ({ request }: Parameters<PlanningPort["plan"]>[0]) => ({
      planId: `${request.requestId}-plan`,
      requestId: request.requestId,
      tenantId: request.tenantContext.tenantId,
      actorId: request.actorContext.actorId,
      strategy: "direct" as const,
      steps: [
        {
          stepId: `${request.requestId}-step-1`,
          capability: request.capability,
          input: request.input as Record<string, unknown>,
          metadata: {},
        },
      ],
      metadata: { version: "v0.9" },
    })),
  };
  const memoryStatus = {
    version: "v0.12" as const,
    mode: "read-only" as const,
    writesEnabled: false as const,
    budget: { maxEntries: 20 },
  };
  const memory = {
    budget: memoryStatus.budget,
    status: memoryStatus,
    prepare: vi.fn(async ({ context }: Parameters<MemoryPort["prepare"]>[0]) => ({
      context,
      selectedCount: context.memoryEntries.length,
      truncated: context.truncated.memoryEntries,
      status: memoryStatus,
    })),
  };
  const learning = { observe: vi.fn(async () => undefined) };
  const executor = {
    execute: vi.fn(
      async ({ invocation }: CapabilityExecuteInput): Promise<CapabilityInvocation> => ({
        ...invocation,
        status: "completed" as const,
        completedAt: NOW,
        output: { resposta: "olá" },
      })
    ),
  };
  const store = {
    saveDecision: vi.fn(async (record: DecisionRecord) => record),
  };
  const deps: IntelligenceRuntimeDeps = {
    policyGate,
    operationalContext,
    planner,
    memory,
    contextEngine: {
      status: () => ({
        version: "v0.15",
        mode: "bounded-relevance",
        budget: {
          maxEntities: 20,
          maxRelationships: 30,
          maxKnowledgeSources: 8,
          maxMemoryEntries: 12,
          maxGoals: 5,
          maxCapabilities: 20,
        },
      }),
      prepare: vi.fn(async ({ context }) => ({
        context,
        selected: {
          entities: context?.entities.length ?? 0,
          relationships: context?.relationships.length ?? 0,
          knowledgeSources: context?.knowledgeSources.length ?? 0,
          memoryEntries: context?.memoryEntries.length ?? 0,
          goals: context?.goals.length ?? 0,
          capabilities: context?.capabilities.length ?? 0,
        },
        truncated: false,
        status: {
          version: "v0.15",
          mode: "bounded-relevance",
          budget: {
            maxEntities: 20,
            maxRelationships: 30,
            maxKnowledgeSources: 8,
            maxMemoryEntries: 12,
            maxGoals: 5,
            maxCapabilities: 20,
          },
        },
      })),
    },
    governance: {
      status: () => ({ version: "v0.19" as const, mode: "human-in-the-loop" as const }),
      assess: vi.fn(async ({ step }) => ({
        version: "v0.19" as const,
        decision: "allow" as const,
        reason: "read-only permitido",
        action: {
          capability: step.capability,
          sideEffect: "none" as const,
          idempotency: "none" as const,
          requiresApproval: false,
        },
      })),
    },
    learning,
    executor,
    store,
    hashValue,
    now,
    ...overrides,
  };
  return { deps, policyGate, operationalContext, planner, memory, learning, executor, store, hashValue };
}

describe("coagentica/intelligence/runtime", () => {
  it("nega quando o gate retorna deny, sem ler contexto nem executar", async () => {
    const { deps, policyGate, operationalContext, executor, store } = makeDeps();
    policyGate.authorize.mockResolvedValueOnce({
      constraint: { decision: "deny", reason: "sem papel" },
    });
    const result = await runIntelligence(makeRequest(), deps);

    expect(result.decision.decision).toBe("deny");
    expect(result.decision.reason).toBe("sem papel");
    expect(result.invocation).toBeNull();
    expect(result.context).toBeNull();
    expect(operationalContext.loadOperationalContext).not.toHaveBeenCalled();
    expect(executor.execute).not.toHaveBeenCalled();
    expect(store.saveDecision).toHaveBeenCalledTimes(1);
  });

  it("adía quando o gate retorna defer, sem ler contexto nem executar", async () => {
    const { deps, policyGate, operationalContext, executor, store } = makeDeps();
    policyGate.authorize.mockResolvedValueOnce({
      constraint: { decision: "defer", reason: "tente depois", retryAt: NOW },
    });
    const result = await runIntelligence(makeRequest(), deps);

    expect(result.decision.decision).toBe("defer");
    expect(operationalContext.loadOperationalContext).not.toHaveBeenCalled();
    expect(executor.execute).not.toHaveBeenCalled();
    expect(store.saveDecision).toHaveBeenCalledTimes(1);
  });

  it("adía por falha fechada quando o gate lança erro", async () => {
    const { deps, policyGate, operationalContext, executor } = makeDeps();
    policyGate.authorize.mockRejectedValueOnce(new Error("gate fora do ar"));
    const result = await runIntelligence(makeRequest(), deps);

    expect(result.decision.decision).toBe("defer");
    expect(result.decision.reason).toContain("falha fechada");
    expect(operationalContext.loadOperationalContext).not.toHaveBeenCalled();
    expect(executor.execute).not.toHaveBeenCalled();
  });

  it("pula a leitura de contexto quando a política não autoriza seleção", async () => {
    const { deps, operationalContext, executor } = makeDeps();
    const result = await runIntelligence(makeRequest(), deps);

    expect(result.decision.decision).toBe("allow");
    expect(result.context).toBeNull();
    expect(operationalContext.loadOperationalContext).not.toHaveBeenCalled();
    expect(executor.execute).toHaveBeenCalledTimes(1);
    expect(executor.execute.mock.calls[0]?.[0].context).toBeNull();
  });

  it("carrega contexto só com a seleção autorizada e executa", async () => {
    const { deps, operationalContext, executor, store, policyGate } = makeDeps();
    policyGate.authorize.mockResolvedValueOnce({
      constraint: { decision: "allow" as const, reason: "liberado" },
      selection: { includeEntities: true },
      limits: { maxEntities: 5 },
    });
    const result = await runIntelligence(makeRequest(), deps);

    expect(operationalContext.loadOperationalContext).toHaveBeenCalledTimes(1);
    expect(operationalContext.loadOperationalContext.mock.calls[0]?.[0]).toMatchObject({
      selection: { includeEntities: true },
      limits: { maxEntities: 5 },
    });
    expect(result.decision.decision).toBe("allow");
    expect(result.decision.reason).toBe("liberado");
    expect(result.context).not.toBeNull();
    expect(executor.execute).toHaveBeenCalledTimes(1);
    expect(store.saveDecision).toHaveBeenCalledTimes(2);
    expect(store.saveDecision.mock.calls[0]?.[0]).toMatchObject({
      decisionId: "req-1-authorization",
      decision: "allow",
      metadata: { requestId: "req-1", phase: "authorization" },
    });
    expect(store.saveDecision.mock.calls[1]?.[0].policyDecision).toMatchObject({
      decision: "allow",
    });
  });

  it("adía por falha fechada quando a carga de contexto falha", async () => {
    const { deps, operationalContext, executor, store, policyGate } = makeDeps();
    policyGate.authorize.mockResolvedValueOnce({
      constraint: { decision: "allow" as const, reason: "liberado" },
      selection: { includeEntities: true },
    });
    operationalContext.loadOperationalContext.mockRejectedValueOnce(
      new Error("fonte indisponível")
    );
    const result = await runIntelligence(makeRequest(), deps);

    expect(result.decision.decision).toBe("defer");
    expect(result.decision.reason).toContain("contexto operacional");
    expect(executor.execute).not.toHaveBeenCalled();
    expect(store.saveDecision).toHaveBeenCalledTimes(1);
  });

  it("escala por falha fechada quando o executor lança erro", async () => {
    const { deps, executor } = makeDeps();
    executor.execute.mockRejectedValueOnce(new Error("ferramenta quebrou"));
    const result = await runIntelligence(makeRequest(), deps);

    expect(result.decision.decision).toBe("escalate");
    expect(result.decision.reason).toContain("ferramenta quebrou");
  });

  it("escala quando o executor retorna status diferente de completed", async () => {
    const { deps, executor } = makeDeps();
    executor.execute.mockResolvedValueOnce({
      invocationId: "req-1-invocation",
      capability: "responder_lead",
      input: { mensagem: "oi" },
      status: "failed",
      startedAt: NOW,
      error: "timeout",
      metadata: {},
      actorContext,
    });
    const result = await runIntelligence(makeRequest(), deps);

    expect(result.decision.decision).toBe("escalate");
    expect(result.invocation?.status).toBe("failed");
  });

  it("nega por mismatch de tenant sem chamar gate, contexto, executor", async () => {
    const { deps, policyGate, operationalContext, executor, store } = makeDeps();
    const otherTenant = createTenantContext({
      tenantId: "tenant-2",
      organizationId: "tenant-2",
      organizationName: "Org 2",
      role: "agent",
      visibilityMode: "own",
      locale: "pt-BR",
      timezone: "America/Sao_Paulo",
      isPlatformAdmin: false,
    });
    const otherActor = createActorContext({
      actorId: "actor-1",
      actorType: "human",
      tenantContext: otherTenant,
      correlationId: "corr-1",
    });
    const request = createIntelligenceRequest({
      requestId: "req-1",
      tenantContext,
      actorContext: otherActor,
      capability: "responder_lead",
      input: { mensagem: "oi" },
    });
    const result = await runIntelligence(request, deps);

    expect(result.decision.decision).toBe("deny");
    expect(result.decision.reason).toContain("fronteira de tenant");
    expect(policyGate.authorize).not.toHaveBeenCalled();
    expect(operationalContext.loadOperationalContext).not.toHaveBeenCalled();
    expect(executor.execute).not.toHaveBeenCalled();
    expect(store.saveDecision).toHaveBeenCalledTimes(1);
  });

  it("não deixa policyDecision do caller desviar do gate", async () => {
    const { deps, policyGate } = makeDeps();
    policyGate.authorize.mockResolvedValueOnce({
      constraint: { decision: "deny", reason: "gate nega" },
    });
    const request = makeRequest({}, { decision: "allow", reason: "caller diz sim" });
    const result = await runIntelligence(request, deps);

    expect(policyGate.authorize).toHaveBeenCalledTimes(1);
    expect(result.decision.decision).toBe("deny");
    expect(result.decision.reason).toBe("gate nega");
  });

  it("usa hash injetado e IDs determinísticos a partir do request", async () => {
    const { deps, hashValue, store } = makeDeps();
    const result = await runIntelligence(
      makeRequest({ requestId: "req-42", input: { mensagem: "oi" } }),
      deps
    );

    expect(result.decision.decisionId).toBe("req-42-decision");
    expect(result.invocation?.invocationId).toBe("req-42-invocation");
    expect(hashValue).toHaveBeenCalledWith({ mensagem: "oi" });
    expect(hashValue).toHaveBeenCalledWith({ resposta: "olá" });
    expect(result.decision.inputHash).toBe('hash:{"mensagem":"oi"}');
    expect(result.decision.outputHash).toBe('hash:{"resposta":"olá"}');
    expect(result.decision.timestamp).toBe(NOW);
    expect(store.saveDecision).toHaveBeenCalledTimes(2);
  });

  it("persiste o DecisionRecord em todos os caminhos de falha fechada", async () => {
    const { deps, store, policyGate } = makeDeps();
    policyGate.authorize.mockResolvedValueOnce({
      constraint: { decision: "deny" as const, reason: "não" },
    });
    await runIntelligence(makeRequest({ requestId: "req-deny" }), deps);
    expect(store.saveDecision).toHaveBeenCalledTimes(1);
    expect(store.saveDecision.mock.calls[0]?.[0].decisionId).toBe("req-deny-decision");
  });

  it("não executa se a autorização write-ahead não puder ser persistida", async () => {
    const { deps, store, executor } = makeDeps();
    store.saveDecision.mockRejectedValueOnce(new Error("store indisponível"));

    const promise = runIntelligence(makeRequest(), deps);
    await expect(promise).rejects.toBeInstanceOf(DecisionPersistenceError);
    await promise.catch((error: unknown) => {
      expect(error).toBeInstanceOf(DecisionPersistenceError);
      const persistence = error as DecisionPersistenceError;
      expect(persistence.phase).toBe("authorization");
      expect(persistence.record.decisionId).toBe("req-1-authorization");
      expect(persistence.invocation).toBeNull();
    });
    expect(executor.execute).not.toHaveBeenCalled();
  });

  it("expõe erro de reconciliação se o outcome falhar depois da execução", async () => {
    const { deps, store, executor } = makeDeps();
    store.saveDecision
      .mockImplementationOnce(async (record: DecisionRecord) => record)
      .mockRejectedValueOnce(new Error("store caiu após execução"));

    const promise = runIntelligence(makeRequest(), deps);
    await expect(promise).rejects.toBeInstanceOf(DecisionPersistenceError);
    await promise.catch((error: unknown) => {
      const persistence = error as DecisionPersistenceError;
      expect(persistence.phase).toBe("outcome");
      expect(persistence.record.decision).toBe("allow");
      expect(persistence.invocation?.status).toBe("completed");
    });
    expect(executor.execute).toHaveBeenCalledTimes(1);
    expect(store.saveDecision.mock.calls[0]?.[0].decisionId).toBe("req-1-authorization");
  });

  it("adia e não executa se a fonte devolver contexto de outro tenant", async () => {
    const { deps, policyGate, operationalContext, executor, store } = makeDeps();
    policyGate.authorize.mockResolvedValueOnce({
      constraint: { decision: "allow" as const, reason: "liberado" },
      selection: { includeEntities: true },
    });
    operationalContext.loadOperationalContext.mockResolvedValueOnce(emptyView("tenant-2"));

    const result = await runIntelligence(makeRequest(), deps);
    expect(result.decision.decision).toBe("defer");
    expect(result.decision.reason).toContain("contexto operacional");
    expect(executor.execute).not.toHaveBeenCalled();
    expect(store.saveDecision).toHaveBeenCalledTimes(1);
  });

  it("falha sem efeitos quando o request não tem identidade canônica", async () => {
    const { deps, policyGate, operationalContext, executor, store } = makeDeps();
    const malformed = {
      requestId: "req-bad",
      capability: "responder_lead",
      input: {},
    } as unknown as IntelligenceRequest;

    await expect(runIntelligence(malformed, deps)).rejects.toBeInstanceOf(
      InvalidIntelligenceRequestError
    );
    expect(policyGate.authorize).not.toHaveBeenCalled();
    expect(operationalContext.loadOperationalContext).not.toHaveBeenCalled();
    expect(executor.execute).not.toHaveBeenCalled();
    expect(store.saveDecision).not.toHaveBeenCalled();
  });

  it("nega quando organizationId diverge do tenant canônico", async () => {
    const { deps, policyGate, executor, store } = makeDeps();
    const inconsistentTenant = createTenantContext({
      tenantId: "tenant-1",
      organizationId: "organization-2",
      organizationName: "Org divergente",
      role: "agent",
      visibilityMode: "own",
      locale: "pt-BR",
      timezone: "America/Sao_Paulo",
      isPlatformAdmin: false,
    });
    const inconsistentActor = createActorContext({
      actorId: "actor-1",
      actorType: "human",
      tenantContext: inconsistentTenant,
      correlationId: "corr-1",
    });
    const request = createIntelligenceRequest({
      requestId: "req-org-mismatch",
      tenantContext: inconsistentTenant,
      actorContext: inconsistentActor,
      capability: "responder_lead",
      input: { mensagem: "oi" },
    });

    const result = await runIntelligence(request, deps);
    expect(result.decision.decision).toBe("deny");
    expect(policyGate.authorize).not.toHaveBeenCalled();
    expect(executor.execute).not.toHaveBeenCalled();
    expect(store.saveDecision).toHaveBeenCalledTimes(1);
  });

  it("persiste autorização antes do planning e propaga identidade do plano", async () => {
    const { deps, planner, executor, store } = makeDeps();
    const result = await runIntelligence(
      makeRequest({ requestId: "req-plan" }),
      deps
    );

    expect(planner.plan).toHaveBeenCalledTimes(1);
    expect(store.saveDecision).toHaveBeenCalledTimes(2);
    const authorizationOrder = store.saveDecision.mock.invocationCallOrder[0]!;
    const planningOrder = planner.plan.mock.invocationCallOrder[0]!;
    const executionOrder = executor.execute.mock.invocationCallOrder[0]!;
    expect(authorizationOrder).toBeLessThan(planningOrder);
    expect(planningOrder).toBeLessThan(executionOrder);
    expect(executor.execute.mock.calls[0]?.[0].invocation.metadata).toMatchObject({
      planId: "req-plan-plan",
      stepId: "req-plan-step-1",
      planningStrategy: "direct",
    });
    expect(result.decision.metadata).toMatchObject({
      planId: "req-plan-plan",
      stepId: "req-plan-step-1",
      planningStrategy: "direct",
    });
  });

  it("adía por falha fechada quando o planner lança erro", async () => {
    const { deps, planner, executor, store } = makeDeps();
    planner.plan.mockRejectedValueOnce(new Error("planner indisponível"));

    const result = await runIntelligence(makeRequest({ requestId: "req-plan-fail" }), deps);

    expect(result.decision.decision).toBe("defer");
    expect(result.decision.reason).toContain("planejar execução");
    expect(result.decision.metadata).toMatchObject({ phase: "planning" });
    expect(executor.execute).not.toHaveBeenCalled();
    expect(store.saveDecision).toHaveBeenCalledTimes(2);
  });

  it("adía quando o plano tenta trocar a capability autorizada", async () => {
    const { deps, planner, executor } = makeDeps();
    const request = makeRequest({ requestId: "req-plan-cap" });
    planner.plan.mockResolvedValueOnce({
      planId: "req-plan-cap-plan",
      requestId: request.requestId,
      tenantId: request.tenantContext.tenantId,
      actorId: request.actorContext.actorId,
      strategy: "direct",
      steps: [
        {
          stepId: "req-plan-cap-step-1",
          capability: "outra.capability",
          input: request.input as Record<string, unknown>,
          metadata: {},
        },
      ],
      metadata: { version: "v0.9" },
    });

    const result = await runIntelligence(request, deps);

    expect(result.decision.decision).toBe("defer");
    expect(executor.execute).not.toHaveBeenCalled();
  });

  it("adía quando o planner altera o input autorizado", async () => {
    const { deps, planner, executor } = makeDeps();
    const request = makeRequest({ requestId: "req-plan-input" });
    planner.plan.mockResolvedValueOnce({
      planId: "req-plan-input-plan",
      requestId: request.requestId,
      tenantId: request.tenantContext.tenantId,
      actorId: request.actorContext.actorId,
      strategy: "direct",
      steps: [
        {
          stepId: "req-plan-input-step-1",
          capability: request.capability,
          input: { adulterado: true },
          metadata: {},
        },
      ],
      metadata: { version: "v0.9" },
    });

    const result = await runIntelligence(request, deps);

    expect(result.decision.decision).toBe("defer");
    expect(executor.execute).not.toHaveBeenCalled();
  });
});
