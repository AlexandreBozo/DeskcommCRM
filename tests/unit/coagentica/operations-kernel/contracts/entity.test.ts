import { describe, it, expect } from "vitest";
import {
  createEntityRef,
  createEntitySnapshot,
  createRelationshipRef,
  isEntityRefBoundToTenant,
  validateEntityRef,
  validateRelationshipRef,
  type EntityRef,
  type RelationshipRef,
} from "@/coagentica/operations-kernel/contracts/entity";

describe("coagentica/operations-kernel/contracts/entity", () => {
  describe("createEntityRef", () => {
    it("cria EntityRef válido", () => {
      const ref = createEntityRef({ entityId: "e1", tenantId: "t1", entityKind: "lead" });
      expect(ref.entityId).toBe("e1");
      expect(ref.tenantId).toBe("t1");
      expect(ref.entityKind).toBe("lead");
    });
    it("trim espaços", () => {
      const ref = createEntityRef({ entityId: " e1 ", tenantId: " t1 ", entityKind: " lead " });
      expect(ref.entityId).toBe("e1");
      expect(ref.tenantId).toBe("t1");
      expect(ref.entityKind).toBe("lead");
    });
    it("lança erro quando entityId está vazio", () => {
      expect(() => createEntityRef({ entityId: "", tenantId: "t1", entityKind: "lead" })).toThrow("entityId é obrigatório");
    });
    it("lança erro quando tenantId está vazio", () => {
      expect(() => createEntityRef({ entityId: "e1", tenantId: "", entityKind: "lead" })).toThrow("tenantId é obrigatório");
    });
    it("lança erro quando entityKind está vazio", () => {
      expect(() => createEntityRef({ entityId: "e1", tenantId: "t1", entityKind: "" })).toThrow("entityKind é obrigatório");
    });
  });

  describe("createEntitySnapshot", () => {
    it("cria EntitySnapshot válido", () => {
      const ref = createEntityRef({ entityId: "e1", tenantId: "t1", entityKind: "lead" });
      const snap = createEntitySnapshot({ ref, version: 1, data: { name: "John" }, source: "test" });
      expect(snap.ref).toBe(ref);
      expect(snap.version).toBe(1);
      expect(snap.data).toEqual({ name: "John" });
      expect(snap.source).toBe("test");
    });
    it("usa createdAt e updatedAt como agora se não fornecidos", () => {
      const ref = createEntityRef({ entityId: "e1", tenantId: "t1", entityKind: "lead" });
      const snap = createEntitySnapshot({ ref, version: 1, data: {}, source: "test" });
      expect(snap.createdAt).toBeDefined();
      expect(snap.updatedAt).toBeDefined();
    });
    it("usa createdAt/updatedAt fornecidos", () => {
      const ref = createEntityRef({ entityId: "e1", tenantId: "t1", entityKind: "lead" });
      const snap = createEntitySnapshot({ ref, version: 1, data: {}, source: "test", createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z" });
      expect(snap.createdAt).toBe("2026-01-01T00:00:00Z");
      expect(snap.updatedAt).toBe("2026-01-01T00:00:00Z");
    });
    it("lança erro quando version < 0", () => {
      const ref = createEntityRef({ entityId: "e1", tenantId: "t1", entityKind: "lead" });
      expect(() => createEntitySnapshot({ ref, version: -1, data: {}, source: "test" })).toThrow("version deve ser >= 0");
    });
    it("lança erro quando source está vazio", () => {
      const ref = createEntityRef({ entityId: "e1", tenantId: "t1", entityKind: "lead" });
      expect(() => createEntitySnapshot({ ref, version: 1, data: {}, source: "" })).toThrow("source é obrigatório");
    });
    it("clona data imutavelmente", () => {
      const ref = createEntityRef({ entityId: "e1", tenantId: "t1", entityKind: "lead" });
      const data = { name: "John" };
      const snap = createEntitySnapshot({ ref, version: 1, data, source: "test" });
      expect(snap.data).toEqual(data);
      expect(snap.data).not.toBe(data);
    });
  });

  describe("createRelationshipRef", () => {
    it("cria RelationshipRef válido", () => {
      const rel = createRelationshipRef({ sourceEntityId: "s1", targetEntityId: "t1", tenantId: "org1", relationshipType: "owns" });
      expect(rel.sourceEntityId).toBe("s1");
      expect(rel.targetEntityId).toBe("t1");
      expect(rel.tenantId).toBe("org1");
      expect(rel.relationshipType).toBe("owns");
    });
    it("inclui roles opcionais", () => {
      const rel = createRelationshipRef({ sourceEntityId: "s1", targetEntityId: "t1", tenantId: "org1", relationshipType: "owns", sourceRole: "owner", targetRole: "target" });
      expect(rel.sourceRole).toBe("owner");
      expect(rel.targetRole).toBe("target");
    });
    it("lança erro quando campos obrigatórios estão vazios", () => {
      expect(() => createRelationshipRef({ sourceEntityId: "", targetEntityId: "t1", tenantId: "org1", relationshipType: "owns" })).toThrow("sourceEntityId é obrigatório");
    });
  });

  describe("isEntityRefBoundToTenant", () => {
    it("retorna true quando tenantId bate", () => {
      const ref: EntityRef = { entityId: "e1", tenantId: "t1", entityKind: "lead" };
      expect(isEntityRefBoundToTenant(ref, "t1")).toBe(true);
    });
    it("retorna false quando tenantId difere", () => {
      const ref: EntityRef = { entityId: "e1", tenantId: "t1", entityKind: "lead" };
      expect(isEntityRefBoundToTenant(ref, "t2")).toBe(false);
    });
  });

  describe("validateEntityRef", () => {
    it("retorna array vazio para ref válido", () => {
      const ref = createEntityRef({ entityId: "e1", tenantId: "t1", entityKind: "lead" });
      expect(validateEntityRef(ref)).toHaveLength(0);
    });
    it("retorna erros para ref com campos faltantes", () => {
      const ref = { entityId: "", tenantId: "", entityKind: "" } as EntityRef;
      const errors = validateEntityRef(ref);
      expect(errors).toContain("entityId é obrigatório");
      expect(errors).toContain("tenantId é obrigatório");
      expect(errors).toContain("entityKind é obrigatório");
    });
  });

  describe("validateRelationshipRef", () => {
    it("retorna array vazio para rel válido", () => {
      const rel = createRelationshipRef({ sourceEntityId: "s1", targetEntityId: "t1", tenantId: "org1", relationshipType: "owns" });
      expect(validateRelationshipRef(rel)).toHaveLength(0);
    });
    it("retorna erros para rel com campos faltantes", () => {
      const rel = { sourceEntityId: "", targetEntityId: "", tenantId: "", relationshipType: "" } as RelationshipRef;
      const errors = validateRelationshipRef(rel);
      expect(errors).toContain("sourceEntityId é obrigatório");
      expect(errors).toContain("targetEntityId é obrigatório");
      expect(errors).toContain("tenantId é obrigatório");
      expect(errors).toContain("relationshipType é obrigatório");
    });
  });
});
