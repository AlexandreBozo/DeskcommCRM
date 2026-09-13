import type { ActorContext } from "@/coagentica/foundation/contracts/tenancy";
import type { WorkflowDefinition, WorkflowRun, WorkflowGraph } from "../contracts/workflow";

/**
 * Converte FlowGraph (formato legado Zod-validated do Deskcomm) para
 * WorkflowGraph (tipo canônico do operations-core).
 *
 * Aceita qualquer objeto com a shape `{ nodes, edges }` — não depende do
 * Zod schema, apenas da compatibilidade estrutural.
 */
export function adaptFlowGraphToWorkflowGraph(
  graph: { nodes: readonly Record<string, unknown>[]; edges: readonly Record<string, unknown>[] }
): WorkflowGraph {
  return {
    nodes: graph.nodes.map((n) => ({
      id: String(n["id"] ?? ""),
      type: String(n["type"] ?? ""),
      label: String(n["label"] ?? ""),
      position: {
        x: Number((n["position"] as Record<string, unknown>)?.["x"] ?? 0),
        y: Number((n["position"] as Record<string, unknown>)?.["y"] ?? 0),
      },
      config: (typeof n["config"] === "object" && n["config"] !== null
        ? n["config"]
        : {}) as Record<string, unknown>,
    })),
    edges: graph.edges.map((e) => ({
      id: String(e["id"] ?? ""),
      source: String(e["source"] ?? ""),
      target: String(e["target"] ?? ""),
      priority: Number(e["priority"] ?? 0),
      condition: (typeof e["condition"] === "object" && e["condition"] !== null
        ? e["condition"]
        : {}) as Record<string, unknown>,
    })),
  };
}

export function adaptDefinitionToRun(
  definition: WorkflowDefinition,
  actorContext: ActorContext,
  runId: string
): WorkflowRun {
  return {
    runId,
    workflowId: definition.workflowId,
    workflowVersion: definition.version,
    tenantId: definition.tenantId,
    actorContext,
    status: "pending",
    currentNodeId: null,
    variables: {},
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: null,
    metadata: {},
  };
}
