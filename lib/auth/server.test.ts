import { describe, expect, it } from "vitest";

import { escolherMembroAtivo, mapearContextoDeAuth } from "@/lib/auth/server";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const ORG_A = "22222222-2222-4222-8222-222222222222";
const ORG_B = "33333333-3333-4333-8333-333333333333";
const context = {
  id: USER_ID,
  email: "context@example.com",
  full_name: "Pessoa do Contexto",
  avatar_url: null,
  is_platform_admin: true,
  organizations: [
    {
      organization_id: ORG_A,
      organization_name: "Alfa",
      role: "admin",
      locale: "pt-BR",
      timezone: null,
      interface_settings: null,
    },
    {
      organization_id: ORG_B,
      organization_name: "Beta",
      role: "viewer",
      locale: null,
      timezone: null,
      interface_settings: null,
    },
  ],
};

describe("mapearContextoDeAuth", () => {
  it("mapeia somente o contexto RPC e preserva preferências disponíveis no metadata", () => {
    const user = mapearContextoDeAuth(context, {
      id: USER_ID,
      email: "auth@example.com",
      user_metadata: { locale: "es", timezone: "America/Sao_Paulo" },
    });
    expect(user).toMatchObject({
      id: USER_ID,
      email: "context@example.com",
      full_name: "Pessoa do Contexto",
      is_platform_admin: true,
      locale: "es",
      timezone: "America/Sao_Paulo",
    });
    expect(user?.organizations).toEqual([
      expect.objectContaining({
        organization_id: ORG_A,
        organization_name: "Alfa",
        role: "admin",
        locale: "pt-BR",
      }),
      expect.objectContaining({
        organization_id: ORG_B,
        organization_name: "Beta",
        role: "viewer",
        locale: null,
      }),
    ]);
  });
  it("falha fechado para contexto de outra identidade ou papel incompatível", () => {
    expect(mapearContextoDeAuth({ ...context, id: ORG_A }, { id: USER_ID })).toBeNull();
    expect(
      mapearContextoDeAuth(
        { ...context, organizations: [{ ...context.organizations[0], role: "owner" }] },
        { id: USER_ID },
      ),
    ).toBeNull();
  });
});

describe("escolherMembroAtivo", () => {
  const memberships = [
    { organization_id: ORG_A, organization_name: "Alfa", role: "admin" as const },
    { organization_id: ORG_B, organization_name: "Beta", role: "viewer" as const },
  ];
  it("aceita o cookie apenas para organização devolvida pelo contexto", () => {
    expect(escolherMembroAtivo(memberships, ORG_B)?.organization_id).toBe(ORG_B);
    expect(
      escolherMembroAtivo(memberships, "44444444-4444-4444-8444-444444444444")?.organization_id,
    ).toBe(ORG_A);
  });
});
