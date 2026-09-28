import { beforeEach, describe, expect, it, vi } from "vitest";

import { requirePlatformAdmin } from "@/lib/auth/requirePlatformAdmin";
import { loadAuthUser } from "@/lib/auth/server";
import type { AuthUser } from "@/lib/auth/types";

const redirect = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/auth/server", () => ({ loadAuthUser: vi.fn() }));

const admin: AuthUser = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "admin@example.com",
  full_name: null,
  avatar_url: null,
  is_platform_admin: true,
  idioma: "pt-BR",
  organizations: [],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("requirePlatformAdmin", () => {
  it("accepts a canonical active platform-admin context without legacy fields or MFA", async () => {
    vi.mocked(loadAuthUser).mockResolvedValue(admin);

    await expect(requirePlatformAdmin()).resolves.toEqual({
      user: admin,
      platformAdmin: { user_id: admin.id, scope: "full", mfa_required: false },
    });
    expect(redirect).not.toHaveBeenCalled();
  });

  it("forbids a revoked or otherwise inactive platform admin", async () => {
    vi.mocked(loadAuthUser).mockResolvedValue({ ...admin, is_platform_admin: false });

    await requirePlatformAdmin();

    expect(redirect).toHaveBeenCalledWith("/admin/forbidden");
  });
});
