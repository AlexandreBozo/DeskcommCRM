import { describe, it, expect } from "vitest";
import {
  createKnowledgeSource,
  updateKnowledgeSource,
  createMemoryEntry,
  addMemoryEntry,
  createGoal,
  completeGoal,
  createCapability,
  createTenantStateSnapshot,
  withKnowledgeSources,
  withMemoryEntries,
  withGoals,
  withCapabilities,
  validateTenantStateSnapshot,
  isGoalTenantBound,
  isTenantStateBound,
  type TenantStateSnapshot,
} from "@/coagentica/tenant-runtime/contracts/state";

describe("coagentica/tenant-runtime/contracts/state", () => {
  const tenantId = "tenant-123";

  describe("createKnowledgeSource", () => {
    it("cria TenantKnowledgeSource válido", () => {
      const ks = createKnowledgeSource({ sourceId: "ks-1", tenantId, name: "My Doc", type: "document" });
      expect(ks.sourceId).toBe("ks-1");
      expect(ks.tenantId).toBe(tenantId);
      expect(ks.name).toBe("My Doc");
      expect(ks.type).toBe("document");
      expect(ks.status).toBe("active");
    });
    it("usa status padrão active", () => {
      const ks = createKnowledgeSource({ sourceId: "ks-1", tenantId, name: "My Doc", type: "faq" });
      expect(ks.status).toBe("active");
    });
    it("lança erro quando sourceId está vazio", () => {
      expect(() => createKnowledgeSource({ sourceId: "", tenantId, name: "X", type: "document" })).toThrow("sourceId é obrigatório");
    });
  });

  describe("updateKnowledgeSource", () => {
    it("atualiza campos seletivamente", () => {
      const ks = createKnowledgeSource({ sourceId: "ks-1", tenantId, name: "Old", type: "document" });
      const updated = updateKnowledgeSource(ks, { name: "New" });
      expect(updated.name).toBe("New");
      expect(ks.name).toBe("Old");
    });
  });

  describe("createMemoryEntry", () => {
    it("cria TenantMemoryEntry válido", () => {
      const me = createMemoryEntry({ entryId: "me-1", tenantId, type: "fact", content: "Hello" });
      expect(me.entryId).toBe("me-1");
      expect(me.type).toBe("fact");
      expect(me.content).toBe("Hello");
    });
    it("usa status padrão active", () => {
      const me = createMemoryEntry({ entryId: "me-1", tenantId, type: "fact", content: "Hello" });
      expect(me.status).toBe("active");
    });
    it("lança erro quando content está vazio", () => {
      expect(() => createMemoryEntry({ entryId: "me-1", tenantId, type: "fact", content: "" })).toThrow("content é obrigatório");
    });
  });

  describe("addMemoryEntry", () => {
    it("adiciona entry ao array", () => {
      const me = createMemoryEntry({ entryId: "me-1", tenantId, type: "fact", content: "Hello" });
      const list = addMemoryEntry([], me);
      expect(list).toHaveLength(1);
    });
    it("retorna novo array imutável", () => {
      const me = createMemoryEntry({ entryId: "me-1", tenantId, type: "fact", content: "Hello" });
      const list = addMemoryEntry([], me);
      expect(list).not.toBe([]);
    });
  });

  describe("createGoal", () => {
    it("cria TenantGoal válido", () => {
      const goal = createGoal({ goalId: "g-1", tenantId, name: "My Goal", description: "Desc" });
      expect(goal.goalId).toBe("g-1");
      expect(goal.status).toBe("draft");
      expect(goal.description).toBe("Desc");
    });
    it("usa status padrão draft", () => {
      const goal = createGoal({ goalId: "g-1", tenantId, name: "My Goal" });
      expect(goal.status).toBe("draft");
    });
  });

  describe("completeGoal", () => {
    it("marca goal como completed", () => {
      const goal = createGoal({ goalId: "g-1", tenantId, name: "My Goal", description: "Desc" });
      const completed = completeGoal(goal);
      expect(completed.status).toBe("completed");
      expect(completed.completedAt).toBeDefined();
    });
  });

  describe("createCapability", () => {
    it("cria TenantCapability válido", () => {
      const cap = createCapability({ capabilityId: "c-1", tenantId, name: "AI Model", type: "ai_model" });
      expect(cap.capabilityId).toBe("c-1");
      expect(cap.type).toBe("ai_model");
      expect(cap.status).toBe("available");
    });
    it("usa config padrão vazio", () => {
      const cap = createCapability({ capabilityId: "c-1", tenantId, name: "AI Model", type: "ai_model" });
      expect(cap.config).toEqual({});
    });
  });

  describe("createTenantStateSnapshot", () => {
    it("cria snapshot válido", () => {
      const snap = createTenantStateSnapshot({ tenantId });
      expect(snap.tenantId).toBe(tenantId);
      expect(snap.knowledgeSources).toEqual([]);
      expect(snap.memoryEntries).toEqual([]);
      expect(snap.goals).toEqual([]);
      expect(snap.capabilities).toEqual([]);
      expect(snap.version).toBe(1);
    });
    it("usa arrays fornecidos", () => {
      const ks = createKnowledgeSource({ sourceId: "ks-1", tenantId, name: "Doc", type: "document" });
      const snap = createTenantStateSnapshot({ tenantId, knowledgeSources: [ks] });
      expect(snap.knowledgeSources).toHaveLength(1);
    });
  });

  describe("with* helpers", () => {
    it("withKnowledgeSources atualiza e incrementa versão", () => {
      const snap = createTenantStateSnapshot({ tenantId });
      const ks = createKnowledgeSource({ sourceId: "ks-1", tenantId, name: "Doc", type: "document" });
      const updated = withKnowledgeSources(snap, [ks]);
      expect(updated.knowledgeSources).toHaveLength(1);
      expect(updated.version).toBe(2);
    });
    it("withMemoryEntries atualiza e incrementa versão", () => {
      const snap = createTenantStateSnapshot({ tenantId });
      const me = createMemoryEntry({ entryId: "me-1", tenantId, type: "fact", content: "Hello" });
      const updated = withMemoryEntries(snap, [me]);
      expect(updated.memoryEntries).toHaveLength(1);
      expect(updated.version).toBe(2);
    });
    it("withGoals atualiza e incrementa versão", () => {
      const snap = createTenantStateSnapshot({ tenantId });
      const goal = createGoal({ goalId: "g-1", tenantId, name: "Goal", description: "Desc" });
      const updated = withGoals(snap, [goal]);
      expect(updated.goals).toHaveLength(1);
      expect(updated.version).toBe(2);
    });
    it("withCapabilities atualiza e incrementa versão", () => {
      const snap = createTenantStateSnapshot({ tenantId });
      const cap = createCapability({ capabilityId: "c-1", tenantId, name: "AI", type: "ai_model" });
      const updated = withCapabilities(snap, [cap]);
      expect(updated.capabilities).toHaveLength(1);
      expect(updated.version).toBe(2);
    });
  });

  describe("validateTenantStateSnapshot", () => {
    it("retorna array vazio para snapshot válido", () => {
      const snap = createTenantStateSnapshot({ tenantId });
      expect(validateTenantStateSnapshot(snap)).toHaveLength(0);
    });
    it("retorna erro quando tenantId está vazio", () => {
      const snap = { tenantId: "", entities: [], relationships: [], knowledgeSources: [], memoryEntries: [], goals: [], capabilities: [], version: 1, snapshotAt: "" } as TenantStateSnapshot;
      const errors = validateTenantStateSnapshot(snap);
      expect(errors).toContain("tenantId é obrigatório");
    });

    it("detecta entidade e relacionamento de outro tenant", () => {
      const snap = createTenantStateSnapshot({
        tenantId,
        entities: [{
          ref: { entityId: "contact-1", tenantId: "other-tenant", entityKind: "contact" },
          version: 1,
          data: {},
          createdAt: "2026-09-01T10:00:00.000Z",
          updatedAt: "2026-09-01T10:00:00.000Z",
          source: "test",
        }],
        relationships: [{
          sourceEntityId: "contact-1",
          targetEntityId: "org-1",
          tenantId: "other-tenant",
          relationshipType: "belongs_to",
        }],
      });
      const errors = validateTenantStateSnapshot(snap);
      expect(errors.some((error) => error.includes("entity contact-1 pertence a outro tenant"))).toBe(true);
      expect(errors.some((error) => error.includes("relationship contact-1:belongs_to pertence a outro tenant"))).toBe(true);
      expect(isTenantStateBound(snap, tenantId)).toBe(false);
    });
  });

  describe("isGoalTenantBound", () => {
    it("retorna true quando goal pertence ao tenant", () => {
      const goal = createGoal({ goalId: "g-1", tenantId, name: "Goal", description: "Desc" });
      expect(isGoalTenantBound(goal, tenantId)).toBe(true);
    });
    it("retorna false quando goal pertence a outro tenant", () => {
      const goal = createGoal({ goalId: "g-1", tenantId, name: "Goal", description: "Desc" });
      expect(isGoalTenantBound(goal, "other")).toBe(false);
    });
  });

  describe("isTenantStateBound", () => {
    it("retorna true quando snapshot pertence ao tenant", () => {
      const snap = createTenantStateSnapshot({ tenantId });
      expect(isTenantStateBound(snap, tenantId)).toBe(true);
    });
  });
});
