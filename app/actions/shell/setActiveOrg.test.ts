import { beforeEach, describe, expect, it, vi } from "vitest";

import { cookies } from "next/headers";
import { audit } from "@/lib/audit";
import { loadAuthUser, mfaEmDivida } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { listarMembershipsTrialing } from "@/lib/auth/trialing-memberships";

vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("@/lib/auth/server", () => ({ loadAuthUser: vi.fn(), mfaEmDivida: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/audit", () => ({ audit: vi.fn(async () => undefined) }));
vi.mock("@/lib/auth/trialing-memberships", () => ({ listarMembershipsTrialing: vi.fn() }));
vi.mock("@/lib/supabase/cookie-secure", () => ({ cookieSecure: () => false }));

const USER_ID = "11111111-1111-4111-8111-111111111111";
const ORG_ID = "22222222-2222-4222-8222-222222222222";

describe("setActiveOrg", () => {
  const set = vi.fn();
  const rpc = vi.fn();
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.mocked(loadAuthUser).mockResolvedValue({ id: USER_ID, support: null } as never);
    vi.mocked(mfaEmDivida).mockResolvedValue(false);
    vi.mocked(cookies).mockResolvedValue({ get: vi.fn(() => undefined), set } as never);
    vi.mocked(createClient).mockResolvedValue({ rpc } as never);
    vi.mocked(listarMembershipsTrialing).mockResolvedValue([]);
  });
  it("autoriza somente quando fn_can_access_org confirma p_org", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    const { setActiveOrg } = await import("./setActiveOrg");
    await expect(setActiveOrg(ORG_ID)).resolves.toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("fn_can_access_org", { p_org: ORG_ID });
    expect(set).toHaveBeenCalledWith("active_org", ORG_ID, expect.any(Object));
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "organization.switched",
        actorUserId: USER_ID,
        organizationId: ORG_ID,
      }),
    );
  });
  it("aceita organização trialing quando a membership fresca confirma acesso", async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    vi.mocked(listarMembershipsTrialing).mockResolvedValue([
      { organization_id: ORG_ID, organization_name: "DOM", role: "admin" },
    ]);
    const { setActiveOrg } = await import("./setActiveOrg");
    await expect(setActiveOrg(ORG_ID)).resolves.toEqual({ ok: true });
    expect(set).toHaveBeenCalledWith("active_org", ORG_ID, expect.any(Object));
  });

  it("nega quando a RPC falha ou não confirma acesso", async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    const { setActiveOrg } = await import("./setActiveOrg");
    await expect(setActiveOrg(ORG_ID)).resolves.toEqual({ ok: false, error: "forbidden" });
    expect(set).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });
});
