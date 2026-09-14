import { describe, it, expect } from "vitest";
import {
  createTenantOperationsCore,
  withTenantState,
  validateTenantOperationsCore,
} from "@/coagentica/tenant-runtime/contracts/operations-core";
import { createTenantStateSnapshot, createKnowledgeSource } from "@/coagentica/tenant-runtime/contracts/state";
import type { ActorContextCore } from "@/coagentica/tenant-runtime/contracts/operations-core";

const actorContext: ActorContextCore = { actorId: "actor-1", actorType: "human", tenantId: "t1", role: "agent", isPlatformAdmin: false, correlationId: "c1" };

describe("coagentica/tenant-runtime/contracts/operations-core — state extensão", () => {
  describe("createTenantOperationsCore inclui state", () => {
    it("cria core com TenantStateSnapshot", () => {
      const core = createTenantOperationsCore({ tenantId: "t1", organizationId: "org", actorContext });
      expect(core.state).toBeDefined();
      expect(core.state.tenantId).toBe("t1");
      expect(core.state.version).toBe(1);
      expect(core.state.knowledgeSources).toEqual([]);
    });
  });

  describe("withTenantState", () => {
    it("substitui state do mesmo tenant", () => {
      const core = createTenantOperationsCore({ tenantId: "t1", organizationId: "org", actorContext });
      const snapshot = createTenantStateSnapshot({ tenantId: "t1", knowledgeSources: [createKnowledgeSource({ sourceId: "ks-1", tenantId: "t1", name: "Docs", type: "document" })], version: 2 });
      const updated = withTenantState(core, snapshot);
      expect(updated.state).toBe(snapshot);
      expect(updated.state.knowledgeSources).toHaveLength(1);
    });

    it("rejeita state de outro tenant", () => {
      const core = createTenantOperationsCore({ tenantId: "t1", organizationId: "org", actorContext });
      const foreign = createTenantStateSnapshot({ tenantId: "t2", version: 2 });
      expect(() => withTenantState(core, foreign)).toThrow("state pertence a outro tenant");
    });

    it("rejeita versão anterior ao state atual", () => {
      const core = createTenantOperationsCore({ tenantId: "t1", organizationId: "org", actorContext });
      const current = withTenantState(core, createTenantStateSnapshot({ tenantId: "t1", version: 3 }));
      const stale = createTenantStateSnapshot({ tenantId: "t1", version: 2 });
      expect(() => withTenantState(current, stale)).toThrow("state version é anterior ao snapshot atual");
    });
  });

  describe("validateTenantOperationsCore", () => {
    it("retorna erro se state for inválido", () => {
      const core = createTenantOperationsCore({ tenantId: "t1", organizationId: "org", actorContext });
      const errors = validateTenantOperationsCore(core);
      expect(errors).toHaveLength(0);
    });
  });
});
