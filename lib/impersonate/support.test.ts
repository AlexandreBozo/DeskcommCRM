import { describe, expect, it } from "vitest";

import { isMissingSupportContextFunction } from "@/lib/impersonate/support";

describe("isMissingSupportContextFunction", () => {
  it("recognizes only the known missing-RPC responses", () => {
    expect(isMissingSupportContextFunction({ code: "PGRST202" })).toBe(true);
    expect(
      isMissingSupportContextFunction({
        message: "Could not find the function public.fn_support_context without parameters",
      }),
    ).toBe(true);
  });

  it("does not turn unrelated support errors into an absent session", () => {
    expect(isMissingSupportContextFunction({ code: "PGRST301", message: "JWT expired" })).toBe(false);
    expect(isMissingSupportContextFunction({ message: "connection refused" })).toBe(false);
    expect(isMissingSupportContextFunction(null)).toBe(false);
  });
});
