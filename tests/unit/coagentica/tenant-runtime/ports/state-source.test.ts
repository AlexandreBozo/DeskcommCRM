import { describe, it, expect } from "vitest";
import type {
  EntityReadPort,
  KnowledgeReadPort,
  MemoryReadPort,
  GoalReadPort,
  CapabilityReadPort,
  StateSnapshotReadPort,
  TenantStateReadPort,
} from "@/coagentica/tenant-runtime/ports/state-source";

describe("coagentica/tenant-runtime/ports/state-source", () => {
  describe("EntityReadPort", () => {
    it("define a interface com métodos de leitura incluindo listRelationships", () => {
      const port: EntityReadPort = {
        getByRef: async () => null,
        getByTenant: async () => [],
        listRefs: async () => [],
        listRelationships: async () => [],
      };
      expect(typeof port.getByRef).toBe("function");
      expect(typeof port.listRelationships).toBe("function");
    });
  });

  describe("KnowledgeReadPort", () => {
    it("define a interface com métodos de leitura de knowledge", () => {
      const port: KnowledgeReadPort = {
        getSource: async () => null,
        listSources: async () => [],
      };
      expect(typeof port.getSource).toBe("function");
      expect(typeof port.listSources).toBe("function");
    });
  });

  describe("MemoryReadPort", () => {
    it("define a interface com métodos de leitura de memory", () => {
      const port: MemoryReadPort = {
        getEntry: async () => null,
        listEntries: async () => [],
        listEntriesByType: async () => [],
      };
      expect(typeof port.getEntry).toBe("function");
    });
  });

  describe("GoalReadPort", () => {
    it("define a interface com métodos de leitura de goals", () => {
      const port: GoalReadPort = {
        getGoal: async () => null,
        listGoals: async () => [],
        listGoalsByStatus: async () => [],
      };
      expect(typeof port.getGoal).toBe("function");
    });
  });

  describe("CapabilityReadPort", () => {
    it("define a interface com métodos de leitura de capabilities", () => {
      const port: CapabilityReadPort = {
        getCapability: async () => null,
        listCapabilities: async () => [],
        listCapabilitiesByType: async () => [],
      };
      expect(typeof port.getCapability).toBe("function");
    });
  });

  describe("StateSnapshotReadPort", () => {
    it("define a interface com métodos de leitura de snapshot", () => {
      const port: StateSnapshotReadPort = {
        getSnapshot: async () => null,
        getSnapshotVersion: async () => 1,
      };
      expect(typeof port.getSnapshot).toBe("function");
    });
  });

  describe("TenantStateReadPort (composite)", () => {
    it("compõe todas as portas de leitura", () => {
      const port: TenantStateReadPort = {
        entities: { getByRef: async () => null, getByTenant: async () => [], listRefs: async () => [], listRelationships: async () => [] },
        knowledge: { getSource: async () => null, listSources: async () => [] },
        memory: { getEntry: async () => null, listEntries: async () => [], listEntriesByType: async () => [] },
        goals: { getGoal: async () => null, listGoals: async () => [], listGoalsByStatus: async () => [] },
        capabilities: { getCapability: async () => null, listCapabilities: async () => [], listCapabilitiesByType: async () => [] },
        snapshot: { getSnapshot: async () => null, getSnapshotVersion: async () => 1 },
      };
      expect(port.entities).toBeDefined();
      expect(port.knowledge).toBeDefined();
      expect(port.memory).toBeDefined();
      expect(port.goals).toBeDefined();
      expect(port.capabilities).toBeDefined();
      expect(port.snapshot).toBeDefined();
    });
  });
});
