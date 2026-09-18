import { createIntelligenceRequest, type IntelligenceRequest } from "../contracts";
import type { ChannelEnvelope } from "../contracts/channel";

export function adaptChannelToIntelligenceRequest<T = Record<string, unknown>>(
  envelope: ChannelEnvelope<T>
): IntelligenceRequest<T> {
  if (!envelope.messageId || envelope.messageId.trim() === "") {
    throw new Error("messageId do canal é obrigatório");
  }

  return createIntelligenceRequest({
    requestId: envelope.messageId,
    tenantContext: envelope.tenantContext,
    actorContext: envelope.actorContext,
    capability: envelope.capability,
    input: envelope.input,
    metadata: {
      channel: envelope.channel,
      ...(envelope.receivedAt !== undefined && { receivedAt: envelope.receivedAt }),
      ...(envelope.metadata ?? {}),
    },
  });
}
