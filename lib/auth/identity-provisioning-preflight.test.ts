import { describe, expect, it } from "vitest";
import { identityProvisioningPreflight as check } from "./identity-provisioning-preflight";
const user = { id: "00000000-0000-4000-8000-000000000001", email: "fixture@example.test", isActive: true, deletedAt: null };
describe("pré-validação Auth sem efeitos externos", () => {
  it("preserva UUID e exige revisão", () => expect(check(user, [])).toEqual({ status: "ready_for_review", userId: user.id }));
  it("reconhece vínculo existente", () => expect(check(user, [user]).status).toBe("already_linked"));
  it("bloqueia mesmo e-mail com outro UUID", () => expect(check(user, [{ ...user, id: "outro" }]).status).toBe("blocked"));
  it("bloqueia mesmo UUID com outro e-mail", () => expect(check(user, [{ ...user, email: "outro@example.test" }]).status).toBe("blocked"));
  it("bloqueia duplicidades", () => expect(check(user, [user, user]).status).toBe("blocked"));
  it("bloqueia inativo", () => expect(check({ ...user, isActive: false }, []).status).toBe("blocked"));
  it("bloqueia excluído", () => expect(check({ ...user, deletedAt: "2026-01-01" }, []).status).toBe("blocked"));
  it("bloqueia UUID inválido", () => expect(check({ ...user, id: "" }, []).status).toBe("blocked"));
  it("bloqueia e-mail vazio", () => expect(check({ ...user, email: "" }, []).status).toBe("blocked"));
  it("não modifica entradas nem retorna e-mail", () => {
    const result = check(Object.freeze(user), Object.freeze([]));
    expect(result).not.toHaveProperty("email");
    expect(result).not.toHaveProperty("role");
  });
});
