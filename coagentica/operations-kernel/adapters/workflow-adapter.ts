import type { ActorContext } from "@/coagentica/foundation/contracts/tenancy";
import type { Database } from "@/lib/database.types";
import type { WorkflowDefinition, WorkflowRun, WorkflowGraph, WorkflowStatus } from "../contracts/workflow";

export type DeskcommAutomationRuleRow =
  Database["public"]["Tables"]["automation_rules"]["Row"];

export type DeskcommJobQueueRow =
  Database["public"]["Tables"]["job_queue"]["Row"];

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  return { ...(value as Record<string, unknown>) };
}

function asRecordArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.map(asRecord);
}

function nonBlankString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function positiveInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 ? value : null;
}

export function mapJobQueueStatus(status: string): WorkflowStatus {
  switch (status) {
    case "running":
      return "running";
    case "done":
    case "completed":
      return "completed";
    case "failed":
    case "dead":
    case "error":
      return "failed";
    case "cancelled":
      return "cancelled";
    case "pending":
    default:
      return "pending";
  }
}

/**
 * Converte FlowGraph (formato legado Zod-validated do Deskcomm) para
 * WorkflowGraph (tipo canônico do operations-kernel).
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

/**
 * Traduz uma automation_rule real do Deskcomm para o contrato canônico.
 * A regra legada continua sendo executada pelo motor atual; este adapter apenas
 * expõe o mesmo fato operacional ao Operations Core, sem alterar o hot path.
 */
export function adaptAutomationRuleToWorkflowDefinition(
  row: DeskcommAutomationRuleRow
): WorkflowDefinition {
  const actions = asRecordArray(row.actions);
  const conditions = Array.isArray(row.conditions) ? [...row.conditions] : [];
  const triggerId = `${row.id}:trigger`;
  const endId = `${row.id}:end`;

  const actionNodes = actions.map((action, index) => {
    const actionType = nonBlankString(action["type"]) ?? `action_${index + 1}`;
    return {
      id: `${row.id}:action:${index + 1}`,
      type: "action",
      label: actionType,
      position: { x: 280 * (index + 1), y: 0 },
      config: { ...action },
    };
  });

  const nodeIds = [triggerId, ...actionNodes.map((node) => node.id), endId];
  const edges = nodeIds.slice(0, -1).map((source, index) => ({
    id: `${row.id}:edge:${index + 1}`,
    source,
    target: nodeIds[index + 1]!,
    priority: index,
    condition: index === 0 && conditions.length > 0 ? { all: [...conditions] } : {},
  }));

  return {
    workflowId: row.id,
    name: row.name,
    description: `Deskcomm automation rule: ${row.trigger_event}`,
    version: 1,
    graph: {
      nodes: [
        {
          id: triggerId,
          type: "trigger",
          label: row.trigger_event,
          position: { x: 0, y: 0 },
          config: {
            event: row.trigger_event,
            conditions: [...conditions],
          },
        },
        ...actionNodes,
        {
          id: endId,
          type: "end",
          label: "end",
          position: { x: 280 * (actions.length + 1), y: 0 },
          config: {},
        },
      ],
      edges,
    },
    tenantId: row.organization_id,
    createdBy: row.created_by_user_id ?? "system",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isPublished: row.is_active,
    tags: ["deskcomm:automation_rule", `trigger:${row.trigger_event}`],
  };
}

/**
 * Traduz um job real do Deskcomm para WorkflowRun. O ator é fornecido pelo
 * chamador porque job_queue não armazena identidade de ator como coluna própria.
 */
export function adaptJobQueueToWorkflowRun(
  row: DeskcommJobQueueRow,
  actorContext: ActorContext
): WorkflowRun {
  const actorTenantId = actorContext.tenantContext?.tenantId ?? actorContext.tenantId ?? "";
  if (actorTenantId && actorTenantId !== row.organization_id) {
    throw new Error("actorContext pertence a outro tenant");
  }

  const payload = asRecord(row.payload);
  const workflowId =
    nonBlankString(payload["workflow_id"]) ??
    nonBlankString(payload["rule_id"]) ??
    `job:${row.kind}`;
  const workflowVersion = positiveInteger(payload["workflow_version"]) ?? 1;

  return {
    runId: row.id,
    workflowId,
    workflowVersion,
    tenantId: row.organization_id,
    actorContext,
    status: mapJobQueueStatus(row.status),
    currentNodeId: row.kind || null,
    variables: { ...payload },
    startedAt: row.created_at,
    updatedAt: row.locked_at ?? row.created_at,
    completedAt: null,
    ...(row.last_error ? { error: row.last_error } : {}),
    metadata: {
      source: "deskcomm:job_queue",
      sourceStatus: row.status,
      contactId: row.contact_id,
      sourceEventId: row.source_event_id,
      priority: row.priority,
      attempts: row.attempts,
      maxAttempts: row.max_attempts,
      runAfter: row.run_after,
      lockedBy: row.locked_by,
    },
  };
}
