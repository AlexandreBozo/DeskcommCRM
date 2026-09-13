import type { ActorContext } from "@/coagentica/foundation/contracts/tenancy";

/**
 * Grafo canônico de workflow — equivalente estrutural ao FlowGraph do Deskcomm
 * (`lib/followup/graph-schema`), mas sem dependência de Zod ou runtime legado.
 *
 * Este tipo existe para que operations-core/contracts não importe `@/lib`.
 * A adaptação do FlowGraph Zod-validated para este tipo vive em
 * `operations-core/adapters/workflow-adapter.ts`.
 *
 * O shape é intencionalmente minimalista: `nodes` e `edges` com os campos que
 * o contrato de operações realmente lê. O runtime legado mantém o Zod schema
 * completo; este tipo é o contrato puro.
 */
export interface WorkflowGraph {
  readonly nodes: readonly WorkflowGraphNode[];
  readonly edges: readonly WorkflowGraphEdge[];
}

export interface WorkflowGraphNode {
  readonly id: string;
  readonly type: string;
  readonly label: string;
  readonly position: { readonly x: number; readonly y: number };
  readonly config: Record<string, unknown>;
}

export interface WorkflowGraphEdge {
  readonly id: string;
  readonly source: string;
  readonly target: string;
  readonly priority: number;
  readonly condition: Record<string, unknown>;
}

export type WorkflowStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

export interface WorkflowDefinition {
  readonly workflowId: string;
  readonly name: string;
  readonly description: string;
  readonly version: number;
  readonly graph: WorkflowGraph;
  readonly tenantId: string;
  readonly createdBy: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly isPublished: boolean;
  readonly tags: readonly string[];
}

export interface WorkflowRun {
  readonly runId: string;
  readonly workflowId: string;
  readonly workflowVersion: number;
  readonly tenantId: string;
  readonly actorContext: ActorContext;
  readonly status: WorkflowStatus;
  readonly currentNodeId: string | null;
  readonly variables: Record<string, unknown>;
  readonly startedAt: string;
  readonly updatedAt: string;
  readonly completedAt: string | null;
  readonly error?: string;
  readonly metadata: Record<string, unknown>;
}

export interface WorkflowRunSnapshot {
  readonly run: WorkflowRun;
  readonly graphSnapshot: WorkflowGraph;
}

export function createWorkflowDefinition(params: {
  workflowId: string;
  name: string;
  description: string;
  version: number;
  graph: WorkflowGraph;
  tenantId: string;
  createdBy: string;
  tags?: readonly string[];
}): WorkflowDefinition {
  if (!params.workflowId || params.workflowId.trim() === "") {
    throw new Error("workflowId é obrigatório");
  }
  if (!params.name || params.name.trim() === "") {
    throw new Error("name é obrigatório");
  }
  if (!params.tenantId || params.tenantId.trim() === "") {
    throw new Error("tenantId é obrigatório");
  }
  if (!params.createdBy || params.createdBy.trim() === "") {
    throw new Error("createdBy é obrigatório");
  }
  if (params.version < 1) {
    throw new Error("version deve ser >= 1");
  }
  const now = new Date().toISOString();
  return {
    workflowId: params.workflowId,
    name: params.name,
    description: params.description,
    version: params.version,
    graph: params.graph,
    tenantId: params.tenantId,
    createdBy: params.createdBy,
    createdAt: now,
    updatedAt: now,
    isPublished: false,
    tags: params.tags ?? [],
  };
}

export function createWorkflowRun(params: {
  runId: string;
  workflowId: string;
  workflowVersion: number;
  tenantId: string;
  actorContext: ActorContext;
  initialVariables?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}): WorkflowRun {
  if (!params.runId || params.runId.trim() === "") {
    throw new Error("runId é obrigatório");
  }
  if (!params.workflowId || params.workflowId.trim() === "") {
    throw new Error("workflowId é obrigatório");
  }
  if (!params.tenantId || params.tenantId.trim() === "") {
    throw new Error("tenantId é obrigatório");
  }
  if (params.workflowVersion < 1) {
    throw new Error("workflowVersion deve ser >= 1");
  }
  const now = new Date().toISOString();
  return {
    runId: params.runId,
    workflowId: params.workflowId,
    workflowVersion: params.workflowVersion,
    tenantId: params.tenantId,
    actorContext: params.actorContext,
    status: "pending",
    currentNodeId: null,
    variables: params.initialVariables ?? {},
    startedAt: now,
    updatedAt: now,
    completedAt: null,
    metadata: params.metadata ?? {},
  };
}

export function validateWorkflowDefinition(def: WorkflowDefinition): readonly string[] {
  const errors: string[] = [];
  if (!def.workflowId || def.workflowId.trim() === "") {
    errors.push("workflowId é obrigatório");
  }
  if (!def.name || def.name.trim() === "") {
    errors.push("name é obrigatório");
  }
  if (!def.tenantId || def.tenantId.trim() === "") {
    errors.push("tenantId é obrigatório");
  }
  if (!def.createdBy || def.createdBy.trim() === "") {
    errors.push("createdBy é obrigatório");
  }
  if (def.version < 1) {
    errors.push("version deve ser >= 1");
  }
  if (!def.graph || !def.graph.nodes || def.graph.nodes.length < 2) {
    errors.push("graph deve ter pelo menos 2 nodes (trigger + end)");
  }
  return errors;
}

export function validateWorkflowRun(run: WorkflowRun): readonly string[] {
  const errors: string[] = [];
  if (!run.runId || run.runId.trim() === "") {
    errors.push("runId é obrigatório");
  }
  if (!run.workflowId || run.workflowId.trim() === "") {
    errors.push("workflowId é obrigatório");
  }
  if (!run.tenantId || run.tenantId.trim() === "") {
    errors.push("tenantId é obrigatório");
  }
  if (run.workflowVersion < 1) {
    errors.push("workflowVersion deve ser >= 1");
  }
  if (!["pending", "running", "completed", "failed", "cancelled"].includes(run.status)) {
    errors.push(`status inválido: ${run.status}`);
  }
  return errors;
}

export function isWorkflowTerminal(status: WorkflowStatus): boolean {
  return status === "completed" || status === "failed" || status === "cancelled";
}

export function canWorkflowTransition(from: WorkflowStatus, to: WorkflowStatus): boolean {
  const transitions: Record<WorkflowStatus, WorkflowStatus[]> = {
    pending: ["running", "cancelled"],
    running: ["completed", "failed", "cancelled"],
    completed: [],
    failed: [],
    cancelled: [],
  };
  return transitions[from]?.includes(to) ?? false;
}
