import type { CapabilityExecutorPort } from "./capability-executor-port";
import type { AgentRuntimeStatus } from "../contracts/agent-runtime";

/**
 * Fronteira canônica do Agent Runtime.
 *
 * Nesta fase o runtime é deliberadamente bounded e não autônomo. Ele preserva
 * o contrato de CapabilityExecutorPort e adiciona apenas status operacional.
 */
export interface AgentRuntimePort extends CapabilityExecutorPort {
  status(): AgentRuntimeStatus;
}
