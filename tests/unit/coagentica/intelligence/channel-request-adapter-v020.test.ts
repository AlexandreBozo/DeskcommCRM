import { describe, expect, it } from "vitest";
import { createActorContext, createTenantContext } from "@/coagentica/foundation/contracts/tenancy";
import { adaptChannelToIntelligenceRequest } from "@/coagentica/intelligence/adapters/channel-request-adapter";

function envelope(channel: "web" | "whatsapp" | "voice" | "crm" | "api") {
  const tenantContext = createTenantContext({
    tenantId: "tenant-1",
    organizationId: "tenant-1",
    organizationName: "Tenant",
    role: "admin",
    visibilityMode: "all",
    locale: "pt-BR",
    timezone: "America/Sao_Paulo",
    isPlatformAdmin: false,
  });
  return {
    channel,
    messageId: `${channel}-message-1`,
    tenantContext,
    actorContext: createActorContext({ actorId: "actor-1", actorType: "human", tenantContext }),
    capability: "system.runtime.info",
    input: { text: "oi" },
    metadata: { origin: "test" },
    receivedAt: "2026-09-18T12:00:00.000Z",
  } as const;
}

describe("channel adapter v0.20", () => {
  it.each(["web", "whatsapp", "voice", "crm", "api"] as const)(
    "normaliza %s para o mesmo IntelligenceRequest",
    (channel) => {
      const request = adaptChannelToIntelligenceRequest(envelope(channel));
      expect(request.requestId).toBe(`${channel}-message-1`);
      expect(request.capability).toBe("system.runtime.info");
      expect(request.input).toEqual({ text: "oi" });
      expect(request.metadata).toMatchObject({
        channel,
        origin: "test",
        receivedAt: "2026-09-18T12:00:00.000Z",
      });
      expect(request.tenantContext.tenantId).toBe("tenant-1");
      expect(request.actorContext.actorId).toBe("actor-1");
    }
  );

  it("rejeita envelope sem messageId", () => {
    const invalid = { ...envelope("web"), messageId: " " };
    expect(() => adaptChannelToIntelligenceRequest(invalid)).toThrow("messageId");
  });
});
