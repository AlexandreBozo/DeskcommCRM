import { describe, expect, it } from "vitest";
import { createActorContext, createTenantContext } from "@/coagentica/foundation/contracts/tenancy";
import {
  adaptAutomationRuleToWorkflowDefinition,
  adaptJobQueueToWorkflowRun,
  mapJobQueueStatus,
  type DeskcommAutomationRuleRow,
  type DeskcommJobQueueRow,
} from "@/coagentica/operations-kernel/adapters/workflow-adapter";

const tenant = createTenantContext({
  tenantId: "org-1",
  organizationId: "org-1",
  organizationName: "Org 1",
  role: "manager",
  visibilityMode: "all",
  locale: "pt-BR",
  timezone: "America/Sao_Paulo",
  isPlatformAdmin: false,
});

const actor = createActorContext({
  actorId: "user-1",
  actorType: "human",
  tenantContext: tenant,
  correlationId: "corr-1",
});

const automationRule = {
  id: "rule-1",
  actions: [
    { type: "send_message", config: { template: "hello" } },
    { type: "add_tag", config: { tag: "hot" } },
  ],
  conditions: [{
    field: "lead.score",
    op: "gt",
    value: 10,
  }],
  created_at: "2026-09-13T12:00:00.000Z",
  created_by_user_id: "user-1",
  is_active: true,
  last_change_actor_kind: "human",
  last_change_at: "2026-09-13T12:00:00.000Z",
  last_run_at: null,
  name: "Follow up lead",
  organization_id: "org-1",
  run_count: 0,
  trigger_event: "lead.created",
  updated_at: "2026-09-13T12:30:00.000Z",
} as unknown as DeskcommAutomationRuleRow;

const job = {
  attempts: 1,
  contact_id: "contact-1",
  created_at: "2026-09-13T13:00:00.000Z",
  id: "job-1",
  kind: "send_message",
  last_error: null,
  locked_at: null,
  locked_by: null,
  max_attempts: 5,
  organization_id: "org-1",
  payload: {
    workflow_id: "rule-1",
    workflow_version: 2,
    message: "oi",
  },
  priority: 10,
  run_after: "2026-09-13T13:00:00.000Z",
  source_event_id: "event-1",
  status: "pending",
} as unknown as DeskcommJobQueueRow;

describe("coagentica/operations-kernel/adapters/workflow-adapter", () => {
  it("traduz automation_rule para WorkflowDefinition", () => {
    const original = JSON.parse(JSON.stringify(automationRule));
    const def = adaptAutomationRuleToWorkflowDefinition(automationRule);

    expect(def).toMatchObject({
      workflowId: "rule-1",
      name: "Follow up lead",
      tenantId: "org-1",
      createdBy: "user-1",
      isPublished: true,
    });
    expect(def.graph.nodes.map(n => n.type)).toEqual(["intentionally-trigger"].map(() => "trigger").concat(["action", "action", "end"]));
    expect(def.graph.nodes[1]!.label).toBe("send_message");
    expect(def.graph.edges[0]!.condition).toEqual({ all: automationRule.conditions });
    expect(automationRule).toEqual(original);
  });

  it("traduz job_queue para WorkflowRun sem inventar história", () => {
    const run = adaptJobQueueToWorkflowRun(job, actor);
    expect(run).toMatchObject({
      runId: "job-1",
      workflowId: "rule-1",
      workflowVersion: 2,
      tenantId: "org-1",
      status: "pending",
      currentNodeId: "send_message",
      startedAt: "2026-09-13T13:00:00.000Z",
      updatedAt: "2026-09-13T13:00:00.000Z",
      completedAt: null,
    });
    expect(run.variables).toMatchObject({ message: "oi" });
    expect(run.metadata).toMatchObject({ source: "deskcomm:job_queue", sourceStatus: "pending" });
  });

  it("converte status legados para status canônicos", () => {
    expect(mapJobQueueStatus("pending")).toBe("pending");
    expect(mapJobQueueStatus("running")).toBe("running");
    expect(mapJobQueueStatus("done")).toBe("completed");
    expect(mapJobQueueStatus("dead")).toBe("failed");
    expect(mapJobQueueStatus("cancelled")).toBe("cancelled");
    expect(mapJobQueueStatus("unknown")).toBe("pending");
  });

  it("rejeita ActorContext de outro tenant", () => {
    const outroTenant = createTenantContext({
      tenantId: "org-2",
      organizationId: "org-2",
      organizationName: "Org 2",
      role: "manager",
      visibilityMode: "all",
      locale: "pt-BR",
      timezone: "America/Sao_Paulo",
      isPlatformAdmin: false,
    });
    const outroActor = createActorContext({
      actorId: "user-2",
      actorType: "human",
      tenantContext: outroTenant,
      correlationId: "corr-2",
    });

    expect(() => adaptJobQueueToWorkflowRun(job, outroActor)).toThrow("outro tenant");
  });
});
