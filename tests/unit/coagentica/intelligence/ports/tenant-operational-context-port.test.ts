import { describe, expect, it } from "vitest";
import type {
  TenantOperationalContextPort,
  TenantOperationalContextView,
} from "@/coagentica/intelligence/ports/tenant-operational-context-port";
import { createTenantContext } from "@/coagentica/foundation/contracts/tenancy";

describe("tenant-operational-context-port", () => {
  it("define contrato read-only independente de implementação", async () => {
    const expected: TenantOperationalContextView = {
      tenantId: "tenant-1",
      organizationId: "tenant-1",
      sourceVersion: 1,
      snapshotAt: "2026-09-14T09:00:00.000Z",
      entities: [],
      relationships: [],
      knowledgeSources: [],
      memoryEntries: [],
      goals: [],
      capabilities: [],
      truncated: {
        entities: false,
        relationships: false,
        knowledgeSources: false,
        memoryEntries: false,
        goals: false,
        capabilities: false,
      },
    };

    const port: TenantOperationalContextPort = {
      async loadOperationalContext(query) {
        expect(query.tenantContext.tenantId).toBe("tenant-1");
        return expected;
      },
    };

    await expect(
      port.loadOperationalContext({
        tenantContext: createTenantContext("tenant-1"),
      })
    ).resolves.toBe(expected);
  });
});
