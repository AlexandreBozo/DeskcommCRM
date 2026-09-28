import { describe, expect, it } from "vitest";

import {
  mapearMembershipsTrialing,
  mesclarMemberships,
} from "@/lib/auth/trialing-memberships";

const ORG_ACTIVE = "11111111-1111-4111-8111-111111111111";
const ORG_TRIALING = "22222222-2222-4222-8222-222222222222";

describe("memberships trialing", () => {
  it("mapeia role canônica e preferências da organização", () => {
    const memberships = mapearMembershipsTrialing([
      {
        organization_id: ORG_TRIALING,
        member_roles: [{ roles: { code: "org_admin", deleted_at: null } }],
        organizations: {
          name: "DOM",
          status: "trialing",
          deleted_at: null,
          metadata: { locale: "pt-BR" },
        },
      },
    ]);

    expect(memberships).toEqual([
      expect.objectContaining({
        organization_id: ORG_TRIALING,
        organization_name: "DOM",
        role: "admin",
        locale: "pt-BR",
      }),
    ]);
  });

  it("não duplica organizações já devolvidas pelo contexto canônico", () => {
    const active = [{
      organization_id: ORG_ACTIVE,
      organization_name: "Principal",
      role: "admin" as const,
    }];
    const trialing = [
      { ...active[0], organization_name: "Duplicada" },
      {
        organization_id: ORG_TRIALING,
        organization_name: "DOM",
        role: "admin" as const,
      },
    ];

    expect(mesclarMemberships(active, trialing).map((org) => org.organization_id)).toEqual([
      ORG_ACTIVE,
      ORG_TRIALING,
    ]);
  });
});
