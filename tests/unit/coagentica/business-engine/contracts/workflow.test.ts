import { describe, it, expect } from "vitest";
import {
  createWorkflowDefinition,
  createWorkflowRun,
  validateWorkflowDefinition,
  validateWorkflowRun,
  isWorkflowTerminal,
  canWorkflowTransition,
  type WorkflowDefinition,
  type WorkflowRun,
  type WorkflowStatus,
  type WorkflowGraph,
} from "@/coagentica/business-engine/contracts/workflow";
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
    {
      id: "trigger-1",
      type: "trigger",
      label: "Start",
      position: { x: 0, y: 0 },
      config: {},
    },
    {
      id: "end-1",
      type: "end",
      label: "End",
      position: { x: 200, y: 0 },
      config: { outcome: "converted" },
    },
  ],
  edges: [
    {
      id: "edge-1",
      source: "trigger-1",
      target: "end-1",
      priority: 0,
      condition: { type: "always" },
    },
  ],
};

describe("coagentica/business-engine/contracts/workflow", () => {
  describe("createWorkflowDefinition", () => {
    it("cria WorkflowDefinition válido", () => {
      const def = createWorkflowDefinition({
        workflowId: "wf-1",
        name: "Test Workflow",
        description: "A test workflow",
        version: 1,
        graph: minimalGraph,
        tenantId: "tenant-123",
        createdBy: "user-456",
        tags: ["tag1", "tag2"],
      });
      expect(def.workflowId).toBe("wf-1");
      expect(def.name).toBe("Test Workflow");
      expect(def.version).toBe(1);
      expect(def.graph).toBe(minimalGraph);
      expect(def.tenantId).toBe("tenant-123");
      expect(def.createdBy).toBe("user-456");
      expect(def.isPublished).toBe(false);
      expect(def.tags).toEqual(["tag1", "tag2"]);
      expect(def.createdAt).toBeDefined();
      expect(def.updatedAt).toBeDefined();
    });

    it("usa tags vazias como padrão", () => {
      const def = createWorkflowDefinition({
        workflowId: "wf-1",
        name: "Test",
        description: "d",
        version: 1,
        graph: minimalGraph,
        tenantId: "t1",
        createdBy: "u1",
      });
      expect(def.tags).toEqual([]);
    });

    it("lança erro quando workflowId está vazio", () => {
      expect(() => createWorkflowDefinition({ ...baseWorkflowParams, workflowId: "" })).toThrow("workflowId é obrigatório");
    });

    it("lança erro quando name está vazio", () => {
      expect(() => createWorkflowDefinition({ ...baseWorkflowParams, name: "" })).toThrow("name é obrigatório");
    });

    it("lança erro quando tenantId está vazio", () => {
      expect(() => createWorkflowDefinition({ ...baseWorkflowParams, tenantId: "" })).toThrow("tenantId é obrigatório");
    });

    it("lança erro quando createdBy está vazio", () => {
      expect(() => createWorkflowDefinition({ ...baseWorkflowParams, createdBy: "" })).toThrow("createdBy é obrigatório");
    });

    it("lança erro quando version < 1", () => {
      expect(() => createWorkflowDefinition({ ...baseWorkflowParams, version: 0 })).toThrow("version deve ser >= 1");
    });
  });

  const baseWorkflowParams = {
    workflowId: "wf-1",
    name: "Test Workflow",
    description: "A test workflow",
    version: 1,
    graph: minimalGraph,
    tenantId: "tenant-123",
    createdBy: "user-456",
  };

  describe("createWorkflowRun", () => {
    it("cria WorkflowRun válido com status pending", () => {
      const run = createWorkflowRun({
        runId: "run-1",
        workflowId: "wf-1",
        workflowVersion: 1,
        tenantId: "tenant-123",
        actorContext: baseActorContext,
        initialVariables: { foo: "bar" },
        metadata: { source: "test" },
      });
      expect(run.runId).toBe("run-1");
      expect(run.workflowId).toBe("wf-1");
      expect(run.workflowVersion).toBe(1);
      expect(run.tenantId).toBe("tenant-123");
      expect(run.actorContext).toBe(baseActorContext);
      expect(run.status).toBe("pending");
      expect(run.currentNodeId).toBeNull();
      expect(run.variables).toEqual({ foo: "bar" });
      expect(run.metadata).toEqual({ source: "test" });
      expect(run.startedAt).toBeDefined();
      expect(run.updatedAt).toBeDefined();
      expect(run.completedAt).toBeNull();
      expect(run.error).toBeUndefined();
    });

    it("usa variáveis e metadata vazias como padrão", () => {
      const run = createWorkflowRun({
        runId: "run-1",
        workflowId: "wf-1",
        workflowVersion: 1,
        tenantId: "t1",
        actorContext: baseActorContext,
      });
      expect(run.variables).toEqual({});
      expect(run.metadata).toEqual({});
    });

    it("lança erro quando runId está vazio", () => {
      expect(() => createWorkflowRun({ ...baseRunParams, runId: "" })).toThrow("runId é obrigatório");
    });

    it("lança erro quando workflowId está vazio", () => {
      expect(() => createWorkflowRun({ ...baseRunParams, workflowId: "" })).toThrow("workflowId é obrigatório");
    });

    it("lança erro quando tenantId está vazio", () => {
      expect(() => createWorkflowRun({ ...baseRunParams, tenantId: "" })).toThrow("tenantId é obrigatório");
    });

    it("lança erro quando workflowVersion < 1", () => {
      expect(() => createWorkflowRun({ ...baseRunParams, workflowVersion: 0 })).toThrow("workflowVersion deve ser >= 1");
    });
  });

  const baseRunParams = {
    runId: "run-1",
    workflowId: "wf-1",
    workflowVersion: 1,
    tenantId: "tenant-123",
    actorContext: baseActorContext,
  };

  describe("validateWorkflowDefinition", () => {
    it("retorna array vazio para definição válida", () => {
      const def = createWorkflowDefinition(baseWorkflowParams);
      expect(validateWorkflowDefinition(def)).toHaveLength(0);
    });

    it("retorna erros para campos obrigatórios ausentes", () => {
      const def: WorkflowDefinition = {
        workflowId: "",
        name: "",
        description: "",
        version: 0,
        graph: { nodes: [], edges: [] },
        tenantId: "",
        createdBy: "",
        createdAt: "",
        updatedAt: "",
        isPublished: false,
        tags: [],
      };
      const errors = validateWorkflowDefinition(def);
      expect(errors).toContain("workflowId é obrigatório");
      expect(errors).toContain("name é obrigatório");
      expect(errors).toContain("tenantId é obrigatório");
      expect(errors).toContain("createdBy é obrigatório");
      expect(errors).toContain("version deve ser >= 1");
      expect(errors).toContain("graph deve ter pelo menos 2 nodes (trigger + end)");
    });
  });

  describe("validateWorkflowRun", () => {
    it("retorna array vazio para run válido", () => {
      const run = createWorkflowRun(baseRunParams);
      expect(validateWorkflowRun(run)).toHaveLength(0);
    });

    it("retorna erros para campos obrigatórios ausentes", () => {
      const run: WorkflowRun = {
        runId: "",
        workflowId: "",
        workflowVersion: 0,
        tenantId: "",
        actorContext: baseActorContext,
        status: "invalid" as WorkflowStatus,
        currentNodeId: null,
        variables: {},
        startedAt: "",
        updatedAt: "",
        completedAt: null,
        metadata: {},
      };
      const errors = validateWorkflowRun(run);
      expect(errors).toContain("runId é obrigatório");
      expect(errors).toContain("workflowId é obrigatório");
      expect(errors).toContain("tenantId é obrigatório");
      expect(errors).toContain("workflowVersion deve ser >= 1");
      expect(errors).toContain("status inválido: invalid");
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
      expect(isWorkflowTerminal("running")).toBe(false);
    });
  });

  describe("canWorkflowTransition", () => {
    it("permite transições válidas", () => {
      expect(canWorkflowTransition("pending", "running")).toBe(true);
      expect(canWorkflowTransition("pending", "cancelled")).toBe(true);
      expect(canWorkflowTransition("running", "completed")).toBe(true);
      expect(canWorkflowTransition("running", "failed")).toBe(true);
      expect(canWorkflowTransition("running", "cancelled")).toBe(true);
    });

    it("não permite transições de estados terminais", () => {
      expect(canWorkflowTransition("completed", "running")).toBe(false);
      expect(canWorkflowTransition("failed", "pending")).toBe(false);
      expect(canWorkflowTransition("cancelled", "running")).toBe(false);
    });

    it("não permite transições inválidas", () => {
      expect(canWorkflowTransition("pending", "completed")).toBe(false);
      expect(canWorkflowTransition("pending", "failed")).toBe(false);
    });
  });
});
