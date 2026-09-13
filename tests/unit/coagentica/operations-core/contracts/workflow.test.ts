import { describe, it, expect } from "vitest";
import {
  createWorkflowDefinition,
  createWorkflowRun,
  validateWorkflowDefinition,
  validateWorkflowRun,
  isWorkflowTerminal,
  canWorkflowTransition,
  type WorkflowGraph,
} from "@/coagentica/operations-core/contracts/workflow";
import { createActorContext, createTenantContext } from "@/coagentica/foundation/contracts/tenancy";

const baseTenantParams = {
  tenantId: "tenant-123",
  organizationId: "org-456",
  organizationName: "Test Org",
  role: "agent" as const,
  visibilityMode: "own_and_unassigned" as const,
  locale: "pt-BR",
  timezone: "America/Sao_Paulo",
  isPlatformAdmin: false,
};

const baseActorContext = createActorContext({
  actorId: "actor-789",
  actorType: "human",
  tenantContext: createTenantContext(baseTenantParams),
  correlationId: "corr-abc",
});

const minimalGraph: WorkflowGraph = {
  nodes: [
    { id: "trigger-1", type: "trigger", label: "Start", position: { x: 0, y: 0 }, config: {} },
    { id: "end-1", type: "end", label: "End", position: { x: 200, y: 0 }, config: { outcome: "converted" } },
  ],
  edges: [{ id: "edge-1", source: "trigger-1", target: "end-1", priority: 0, condition: { type: "always" } }],
};

const baseWorkflowParams = {
  workflowId: "wf-1",
  name: "Test Workflow",
  description: "A test workflow",
  version: 1,
  graph: minimalGraph,
  tenantId: "tenant-123",
  createdBy: "user-456",
};

const baseRunParams = {
  runId: "run-1",
  workflowId: "wf-1",
  workflowVersion: 1,
  tenantId: "tenant-123",
  actorContext: baseActorContext,
};

describe("coagentica/operations-core/contracts/workflow", () => {
  describe("createWorkflowDefinition", () => {
    it("cria WorkflowDefinition válido", () => {
      const def = createWorkflowDefinition({ ...baseWorkflowParams, tags: ["tag1"] });
      expect(def.workflowId).toBe("wf-1");
      expect(def.isPublished).toBe(false);
    });
    it("lança erro quando version < 1", () => {
      expect(() => createWorkflowDefinition({ ...baseWorkflowParams, version: 0 })).toThrow("version deve ser >= 1");
    });
  });

  describe("createWorkflowRun", () => {
    it("cria WorkflowRun válido com status pending", () => {
      const run = createWorkflowRun({ ...baseRunParams, initialVariables: { foo: "bar" } });
      expect(run.runId).toBe("run-1");
      expect(run.status).toBe("pending");
      expect(run.completedAt).toBeNull();
    });
  });

  describe("validateWorkflowDefinition", () => {
    it("retorna array vazio para definição válida", () => {
      const def = createWorkflowDefinition(baseWorkflowParams);
      expect(validateWorkflowDefinition(def)).toHaveLength(0);
    });
  });

  describe("validateWorkflowRun", () => {
    it("retorna array vazio para run válido", () => {
      const run = createWorkflowRun(baseRunParams);
      expect(validateWorkflowRun(run)).toHaveLength(0);
    });
  });

  describe("isWorkflowTerminal", () => {
    it("retorna true para status terminais", () => {
      expect(isWorkflowTerminal("completed")).toBe(true);
      expect(isWorkflowTerminal("failed")).toBe(true);
      expect(isWorkflowTerminal("cancelled")).toBe(true);
    });
    it("retorna false para status não-terminais", () => {
      expect(isWorkflowTerminal("pending")).toBe(false);
    });
  });

  describe("canWorkflowTransition", () => {
    it("permite transições válidas", () => {
      expect(canWorkflowTransition("pending", "running")).toBe(true);
      expect(canWorkflowTransition("running", "completed")).toBe(true);
    });
    it("não permite transições inválidas", () => {
      expect(canWorkflowTransition("pending", "completed")).toBe(false);
    });
  });
});
