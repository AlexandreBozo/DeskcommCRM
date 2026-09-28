import { describe, expect, it } from "vitest";

import { isCanonicalCrmUrl } from "@/lib/supabase/canonical-crm";

describe("isCanonicalCrmUrl", () => {
  it("matches only the configured canonical project reference", () => {
    expect(isCanonicalCrmUrl("https://dlozdzcxxapmizdprjcp.supabase.co")).toBe(true);
    expect(isCanonicalCrmUrl("https://other-project.supabase.co")).toBe(false);
    expect(isCanonicalCrmUrl("not a URL")).toBe(false);
  });
});
