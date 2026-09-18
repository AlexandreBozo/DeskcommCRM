import type { ActorContext, TenantContext } from "@/coagentica/foundation/contracts/tenancy";

export type ChannelKind = "web" | "whatsapp" | "voice" | "crm" | "api";

export interface ChannelEnvelope<T = Record<string, unknown>> {
  readonly channel: ChannelKind;
  readonly messageId: string;
  readonly tenantContext: TenantContext;
  readonly actorContext: ActorContext;
  readonly capability: string;
  readonly input: T;
  readonly metadata?: Record<string, unknown>;
  readonly receivedAt?: string;
}
