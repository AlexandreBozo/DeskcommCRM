import { describe, it, expect } from "vitest";
import type {
  CapabilityExecutorPort,
  CapabilityExecuteInput,
} from "@/coagentica/intelligence/ports/capability-executor-port";
import type { CapabilityInvocation } from "@/coagentica/intelligence/contracts";
import type { TenantOperationalContextView } from "@/coagentica/intelligence/ports/tenant-operational-context-port";
import { createTenantContext } from "@/coagentica/foundation/contracts/tenancy";
import { createActorContext } from "@/coagentica/foundation/contracts/tenancy";
import { createIntelligenceRequest } from "@/coagentica/intelligence/contracts";

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

const NOW = "2026-09-14T00:00:00.000Z";

function emptyView(): TenantOperationalContextView {
  return {
    tenantId: "tenant-1",
    organizationId: "tenant-1",
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

describe("coagentica/intelligence/ports/capability-executor-port", () => {
  describe("CapabilityExecutorPort", () => {
    it("define contrato com método execute", () => {
      const port: CapabilityExecutorPort = {
        execute: async (input) => ({
          ...input.invocation,
          status: "completed",
          completedAt: NOW,
          output: { resposta: "olá" },
        }),
      };
      expect(typeof port.execute).toBe("function");
    });

    it("execute retorna CapabilityInvocation", async () => {
      const invocation: CapabilityInvocation = {
        invocationId: "inv-1",
        capability: "responder_lead",
        input: { mensagem: "oi" },
        status: "pending",
        startedAt: NOW,
        metadata: {},
        actorContext,
      };

      const port: CapabilityExecutorPort = {
        execute: async (input) => ({
          ...input.invocation,
          status: "completed",
          completedAt: NOW,
          output: { resposta: "olá" },
        }),
      };

      const request = createIntelligenceRequest({
        requestId: "req-1",
        tenantContext,
        actorContext,
        capability: "responder_lead",
        input: { mensagem: "oi" },
      });

      const result = await port.execute({
        request,
        invocation,
        context: emptyView(),
      });

      expect(result.status).toBe("completed");
      expect(result.completedAt).toBe(NOW);
      expect(result.output).toEqual({ resposta: "olá" });
    });

    it("execute pode retornar failed", async () => {
      const invocation: CapabilityInvocation = {
        invocationId: "inv-1",
        capability: "responder_lead",
        input: { mensagem: "oi" },
        status: "pending",
        startedAt: NOW,
        metadata: {},
        actorContext,
      };

      const port: CapabilityExecutorPort = {
        execute: async (input) => ({
          ...input.invocation,
          status: "failed",
          completedAt: NOW,
          error: "timeout",
        }),
      };

      const request = createIntelligenceRequest({
        requestId: "req-1",
        tenantContext,
        actorContext,
        capability: "responder_lead",
        input: { mensagem: "oi" },
      });

      const result = await port.execute({
        request,
        invocation,
        context: null,
      });

      expect(result.status).toBe("failed");
      expect(result.error).toBe("timeout");
    });

    it("execute pode lançar erro", async () => {
      const invocation: CapabilityInvocation = {
        invocationId: "inv-1",
        capability: "responder_lead",
        input: { mensagem: "oi" },
        status: "pending",
        startedAt: NOW,
        metadata: {},
        actorContext,
      };

      const port: CapabilityExecutorPort = {
        execute: async () => {
          throw new Error("ferramenta quebrou");
        },
      };

      const request = createIntelligenceRequest({
        requestId: "req-1",
        tenantContext,
        actorContext,
        capability: "responder_lead",
        input: { mensagem: "oi" },
      });

      await expect(
        port.execute({ request, invocation, context: null })
      ).rejects.toThrow("ferramenta quebrou");
    });
  });

  describe("CapabilityExecuteInput", () => {
    it("contém request, invocation e context", () => {
      const input: CapabilityExecuteInput = {
        request: createIntelligenceRequest({
          requestId: "req-1",
          tenantContext,
          actorContext,
          capability: "responder_lead",
          input: {},
        }),
        invocation: {
          invocationId: "inv-1",
          capability: "responder_lead",
          input: {},
          status: "pending",
          startedAt: NOW,
          metadata: {},
          actorContext,
        },
        context: emptyView(),
      };

      expect(input.request.requestId).toBe("req-1");
      expect(input.invocation.invocationId).toBe("inv-1");
      expect(input.context).not.toBeNull();
    });

    it("context pode ser null quando a política não autoriza seleção", () => {
      const input: CapabilityExecuteInput = {
        request: createIntelligenceRequest({
          requestId: "req-1",
          tenantContext,
          actorContext,
          capability: "responder_lead",
          input: {},
        }),
        invocation: {
          invocationId: "inv-1",
          capability: "responder_lead",
          input: {},
          status: "pending",
          startedAt: NOW,
          metadata: {},
          actorContext,
        },
        context: null,
      };

      expect(input.context).toBeNull();
    });
  });
});
